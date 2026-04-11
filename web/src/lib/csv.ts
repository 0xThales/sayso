import type { Form, FormResponse } from "./api";

function escapeCSV(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCSV(form: Form, responses: FormResponse[]) {
  const fieldHeaders = form.fields.map((f) => f.label);
  const headers = [...fieldHeaders, "Date", "Duration (s)", "Completed"];

  const rows = responses.map((r) => {
    const fieldValues = form.fields.map((f) => escapeCSV(r.answers[f.id]));
    const date = new Date(r.createdAt).toISOString();
    const duration = r.duration ?? "";
    const completed = r.completed ? "Yes" : "No";
    return [...fieldValues, date, duration, completed].join(",");
  });

  const csv = [headers.map(escapeCSV).join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${form.slug}-responses.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
