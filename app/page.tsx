"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HISTORY_KEY, inputsFromHash, inputsToHash, mergeHistory, parseHistory, serializeHistory, type CalculatorInputs, type HistoryEntry, type Subject } from "@/lib/history";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

export default function GPACalculator() {
  const [subjects, setSubjects] = useState<Subject[]>([{ name: "", credits: 0, grade: "" }]);
  const [sgpa, setSGPA] = useState<number | null>(null);
  const [cgpa, setCGPA] = useState<number | null>(null);
  const [previousCGPA, setPreviousCGPA] = useState<number>(0);

  const [semesterName, setSemesterName] = useState("Semester 1");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  const historyRef = useRef<HistoryEntry[]>([]);
  const importInput = useRef<HTMLInputElement>(null);

  const loadInputs = (inputs: CalculatorInputs) => {
    setSemesterName(inputs.name);
    setSubjects(inputs.subjects.map((subject) => ({ ...subject })));
    setPreviousCGPA(inputs.previousCGPA);
    setSGPA(null);
    setCGPA(null);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      const entries = saved ? mergeHistory([], parseHistory(JSON.parse(saved))) : [];
      historyRef.current = entries;
      setHistory(entries);
      const numbers = entries.map((entry) => Number(/^Semester (\d+)$/.exec(entry.name)?.[1]) || 0);
      setSemesterName(`Semester ${Math.max(0, ...numbers) + 1}`);
    } catch {
      setStorageError("Saved history could not be read. Starting with empty history.");
    }
    setReady(true);
    const loadHash = () => {
      try {
        const inputs = inputsFromHash(window.location.hash);
        if (inputs) loadInputs(inputs);
      } catch {
        setMessage("This share link is invalid. Calculator inputs were not changed.");
      }
    };
    loadHash();
    window.addEventListener("hashchange", loadHash);
    try {
      if (navigator.storage?.persist) void navigator.storage.persist().catch(() => {});
    } catch { /* Persistence is optional; history still works without it. */ }
    return () => window.removeEventListener("hashchange", loadHash);
  }, []);

  const saveHistory = (entries: HistoryEntry[]) => {
    historyRef.current = entries;
    setHistory(entries);
    try {
      localStorage.setItem(HISTORY_KEY, serializeHistory(entries));
      setStorageError("");
    } catch {
      setStorageError("History could not be saved in this browser. Export a backup to keep it.");
    }
  };

  const exportHistory = () => {
    const url = URL.createObjectURL(new Blob([serializeHistory(history)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "celestius-gpa-history.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importHistory = async (file: File) => {
    try {
      const imported = parseHistory(JSON.parse(await file.text()));
      saveHistory(mergeHistory(historyRef.current, imported));
      setMessage("History imported. Duplicate IDs were skipped; the latest 20 entries are kept.");
    } catch {
      setMessage("Invalid or unsupported history file. Existing history was not changed.");
    }
  };

  const shareLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.hash = inputsToHash({ name: semesterName, subjects, previousCGPA });
      window.history.replaceState(null, "", url);
      try {
        await navigator.clipboard.writeText(url.href);
        setMessage("Share link copied to clipboard.");
      } catch {
        setMessage("Share link is ready. Copy the URL from your address bar.");
      }
    } catch {
      setMessage("The share link could not be created.");
    }
  };

  const gradePoints: { [key: string]: number } = {
    O: 10,
    "A+": 9,
    A: 8,
    "B+": 7,
    B: 6,
    C: 5,
    RE: 0,
  };

  const addSubject = () => {
    setSubjects([...subjects, { name: "", credits: 0, grade: "" }]);
  };

  const removeSubject = (index: number) => {
    setSubjects(subjects.filter((_, i) => i !== index));
  };

  const handleSubjectChange = (index: number, field: keyof Subject, value: string | number) => {
    const newSubjects = [...subjects];
    newSubjects[index] = { ...newSubjects[index], [field]: value };
    setSubjects(newSubjects);
  };

  const calculateGPA = () => {
    let totalGradePoints = 0;
    let totalCredits = 0;

    subjects.forEach((subject) => {
      if (subject.credits > 0 && gradePoints[subject.grade] !== undefined) {
        totalGradePoints += subject.credits * gradePoints[subject.grade];
        totalCredits += subject.credits;
      }
    });

    const calculatedSGPA = totalCredits > 0 ? totalGradePoints / totalCredits : 0;
    setSGPA(Number.parseFloat(calculatedSGPA.toFixed(2)));

    const calculatedCGPA = previousCGPA > 0 ? (calculatedSGPA + previousCGPA) / 2 : calculatedSGPA;
    setCGPA(Number.parseFloat(calculatedCGPA.toFixed(2)));
    saveHistory(mergeHistory([{
      id: crypto.randomUUID(),
      name: semesterName.trim() || "Semester 1",
      savedAt: new Date().toISOString(),
      subjects: subjects.map((subject) => ({ ...subject })),
      previousCGPA,
      result: { sgpa: Number.parseFloat(calculatedSGPA.toFixed(2)), cgpa: Number.parseFloat(calculatedCGPA.toFixed(2)) },
    }], history));
  };

  return (
    <div className="container mx-auto p-4">
      <Image src="/athena.webp" alt="" aria-hidden="true" width={901} height={1600} className="mascot mascot-athena" />
      <Image src="/hephaestus.webp" alt="" aria-hidden="true" width={975} height={1600} className="mascot mascot-hephaestus" />
      <Card className="w-full max-w-2xl mx-auto calculator-card text-white">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            <Link href="https://celestius.in" target="_blank" className="text-warning hover:text-warning-300">
              <Image src="/celestius-logo.png" alt="Celestius" width={482} height={139} priority className="mx-auto h-auto w-60" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label htmlFor="semesterName">Semester name</Label>
            <Input id="semesterName" value={semesterName} onChange={(e) => setSemesterName(e.target.value)} className="calculator-input" />
          </div>
          <div className="space-y-4">
            {subjects.map((subject, index) => (
              <div key={index} className="flex items-center space-x-2">
                {/* Subject Name Input */}
                <Input
                  placeholder="Subject Name"
                  value={subject.name}
                  onChange={(e) => handleSubjectChange(index, "name", e.target.value)}
                  className="flex-grow calculator-input text-white"
                />

                {/* Credits Input */}
                <Input
                  type="number"
                  placeholder="Credits"
                  min="0"
                  value={subject.credits || ""}
                  onChange={(e) => handleSubjectChange(index, "credits", Number(e.target.value) || 0)}
                  className="w-20 calculator-input text-white"
                />

                {/* Grade Select Dropdown */}
                <Select 
                  value={subject.grade} 
                  onValueChange={(value) => handleSubjectChange(index, "grade", value)}
                >
                  <SelectTrigger className="w-24 calculator-input text-white border border-white/10">
                    <SelectValue>
                      {subject.grade || "Grade"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent 
                    className="calculator-input text-white border border-white/10 rounded-md"
                    side="bottom"
                    align="center"
                  >
                    {Object.keys(gradePoints).map((grade) => (
                      <SelectItem 
                        key={grade} 
                        value={grade}
                        className="focus:bg-white/10"
                      >
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Remove Button */}
                <Button variant="destructive" size="icon" onClick={() => removeSubject(index)} disabled={subjects.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Add Subject Button */}
            <Button onClick={addSubject} className="w-full theme-secondary">
              <Plus className="mr-2 h-4 w-4" /> Add Subject
            </Button>
          </div>

          {/* Previous CGPA Input */}
          <div className="mt-4">
            <Label htmlFor="previousCGPA" className="text-white">
              Previous CGPA
            </Label>
            <Input
              id="previousCGPA"
              type="number"
              min="0"
              step="0.01"
              value={previousCGPA || ""}
              onChange={(e) => setPreviousCGPA(Number(e.target.value) || 0)}
              placeholder="Enter previous CGPA"
              className="calculator-input text-white"
            />
          </div>

          {/* Calculate Button */}
          <Button disabled={!ready} onClick={calculateGPA} className="w-full mt-4 theme-primary">
            Calculate GPA
          </Button>

          {/* Results Display */}
          {sgpa !== null && cgpa !== null && (
            <div className="mt-4 space-y-2 text-center">
              <p className="text-lg font-semibold">
                SGPA: <span className="text-[#ffcc00]">{sgpa}</span>
              </p>
              <p className="text-lg font-semibold">
                CGPA: <span className="text-[#ffcc00]">{cgpa}</span>
              </p>
            </div>
          )}
          <Button onClick={shareLink} className="theme-secondary mt-4 w-full">Share link</Button>
          <section aria-labelledby="history-title" className="mt-6 border-t border-white/10 pt-6">
            <h2 id="history-title" className="text-xl font-semibold">Calculation history</h2>
            <div className="my-4 flex flex-wrap gap-2">
              <Button className="theme-secondary" disabled={!ready} onClick={exportHistory}>Export</Button>
              <Button className="theme-secondary" disabled={!ready} onClick={() => importInput.current?.click()}>Import</Button>
              <input ref={importInput} type="file" accept=".json,application/json" className="hidden" aria-label="Import history file" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importHistory(file);
                event.target.value = "";
              }} />
              <Button className="theme-secondary" disabled={!history.length} onClick={() => {
                if (window.confirm("Clear all calculation history? This cannot be undone.")) saveHistory([]);
              }}>Clear all history</Button>
            </div>
            {!history.length && <p className="text-sm text-zinc-400">No saved calculations yet.</p>}
            <ul className="space-y-3">
              {history.map((entry) => (
                <li key={entry.id} className="rounded-xl border border-white/10 p-4">
                  <p className="break-words font-semibold">{entry.name}</p>
                  <time className="text-sm text-zinc-400" dateTime={entry.savedAt}>{new Date(entry.savedAt).toLocaleString()}</time>
                  <p className="mt-1 text-sm">SGPA: {entry.result.sgpa} · CGPA: {entry.result.cgpa}</p>
                  <div className="mt-3 flex gap-2">
                    <Button className="theme-secondary" size="sm" onClick={() => loadInputs(entry)}>Load</Button>
                    <Button className="theme-secondary" size="sm" onClick={() => saveHistory(history.filter((item) => item.id !== entry.id))}>Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <p role="status" className="mt-3 text-sm text-zinc-300">{message}</p>
          {storageError && <p role="alert" className="mt-3 text-sm text-[#ffcc00]">{storageError}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
