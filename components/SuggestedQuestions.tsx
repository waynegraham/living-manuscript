"use client";

import type { ResponseLanguage } from "@/lib/schemas";

export default function SuggestedQuestions({ questions, arabicQuestions, language, onSelect }: {
  questions: string[];
  arabicQuestions: string[];
  language: ResponseLanguage;
  onSelect: (question: string) => void;
}) {
  const prompts = language === "ar" ? arabicQuestions : questions;
  return (
    <div lang={language} dir={language === "ar" ? "rtl" : "ltr"}>
      <h3 className="eyebrow mb-3">{language === "ar" ? "من وين نبدأ؟" : "A place to begin"}</h3>
      <div className="flex flex-col gap-2">
        {prompts.map((question) => (
          <button key={question} type="button" onClick={() => onSelect(question)} className="group flex min-h-11 items-center justify-between gap-3 rounded-sm border border-line px-4 py-3 text-start text-sm transition-colors hover:border-olive/50 hover:bg-parchment">
            {question}<span aria-hidden="true" className="text-muted transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1">{language === "ar" ? "↖" : "↗"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
