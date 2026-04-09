import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { createForm, fetchForm, updateForm } from "@/lib/api";
import type { FieldType, FormField } from "@/types/forms";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "long_text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / No" },
  { value: "enum", label: "Single choice" },
  { value: "multi_select", label: "Multi select" },
  { value: "email", label: "Email" },
  { value: "date", label: "Date" },
  { value: "scale", label: "Scale" },
];

function newField(): FormField {
  return {
    id: crypto.randomUUID().slice(0, 8),
    label: "",
    type: "text",
    required: true,
  };
}

export function FormEditor() {
  const { slug } = useParams();
  const isEdit = Boolean(slug);
  const navigate = useNavigate();

  const [formId, setFormId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>([newField()]);
  const [greeting, setGreeting] = useState("");
  const [personality, setPersonality] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!slug) return;
    fetchForm(slug)
      .then((form) => {
        setFormId(form.id);
        setTitle(form.title);
        setDescription(form.description);
        setFields(form.fields.length ? form.fields : [newField()]);
        setGreeting(form.greeting ?? "");
        setPersonality(form.personality ?? "");
      })
      .catch(() => navigate("/dashboard"))
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  function updateField(index: number, patch: Partial<FormField>) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function moveField(index: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index]!, next[target]!] = [next[target]!, next[index]!];
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim()) return alert("Title is required");
    const validFields = fields.filter((f) => f.label.trim());
    if (!validFields.length) return alert("Add at least one field with a label");

    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        fields: validFields,
        greeting: greeting.trim() || undefined,
        personality: personality.trim() || undefined,
      };

      if (isEdit && formId) {
        await updateForm(formId, data);
        navigate("/dashboard");
      } else {
        const created = await createForm(data);
        navigate(`/forms/${created.slug}`);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-stone-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-stone-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link
            to="/dashboard"
            className="text-sm text-stone-500 transition hover:text-stone-900"
          >
            &larr; Back
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create form"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Title & Description */}
        <section>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Form title"
            className="w-full font-display text-4xl font-semibold tracking-tight placeholder:text-stone-300 focus:outline-none"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short description (optional)"
            className="mt-3 w-full text-lg text-stone-500 placeholder:text-stone-300 focus:outline-none"
          />
        </section>

        {/* Fields */}
        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold">Questions</h2>
          <div className="mt-4 space-y-3">
            {fields.map((field, i) => (
              <div
                key={field.id}
                className="rounded-xl border border-stone-200 px-5 py-4"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-2 text-xs font-medium text-stone-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) =>
                        updateField(i, { label: e.target.value })
                      }
                      placeholder="Question label"
                      className="w-full font-medium placeholder:text-stone-300 focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateField(i, {
                            type: e.target.value as FieldType,
                          })
                        }
                        className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm focus:outline-none"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1.5 text-sm text-stone-500">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) =>
                            updateField(i, { required: e.target.checked })
                          }
                          className="accent-black"
                        />
                        Required
                      </label>
                    </div>
                    {(field.type === "enum" ||
                      field.type === "multi_select") && (
                      <input
                        type="text"
                        value={field.options?.join(", ") ?? ""}
                        onChange={(e) =>
                          updateField(i, {
                            options: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Options (comma-separated)"
                        className="w-full text-sm text-stone-600 placeholder:text-stone-300 focus:outline-none"
                      />
                    )}
                    {field.type === "scale" && (
                      <div className="flex items-center gap-2 text-sm text-stone-500">
                        <input
                          type="number"
                          value={field.validation?.min ?? 1}
                          onChange={(e) =>
                            updateField(i, {
                              validation: {
                                ...field.validation,
                                min: Number(e.target.value),
                              },
                            })
                          }
                          className="w-16 rounded-lg border border-stone-200 px-2 py-1 text-center focus:outline-none"
                        />
                        <span>to</span>
                        <input
                          type="number"
                          value={field.validation?.max ?? 10}
                          onChange={(e) =>
                            updateField(i, {
                              validation: {
                                ...field.validation,
                                max: Number(e.target.value),
                              },
                            })
                          }
                          className="w-16 rounded-lg border border-stone-200 px-2 py-1 text-center focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveField(i, -1)}
                      disabled={i === 0}
                      className="rounded p-1 text-stone-400 transition hover:text-stone-700 disabled:opacity-30"
                      title="Move up"
                    >
                      &uarr;
                    </button>
                    <button
                      onClick={() => moveField(i, 1)}
                      disabled={i === fields.length - 1}
                      className="rounded p-1 text-stone-400 transition hover:text-stone-700 disabled:opacity-30"
                      title="Move down"
                    >
                      &darr;
                    </button>
                    <button
                      onClick={() => removeField(i)}
                      disabled={fields.length === 1}
                      className="rounded p-1 text-stone-400 transition hover:text-red-500 disabled:opacity-30"
                      title="Remove"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setFields((prev) => [...prev, newField()])}
            className="mt-3 w-full rounded-xl border border-dashed border-stone-300 py-3 text-sm text-stone-500 transition hover:border-stone-400 hover:text-stone-700"
          >
            + Add question
          </button>
        </section>

        {/* Voice config */}
        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold">Voice agent</h2>
          <p className="mt-1 text-sm text-stone-500">
            Configure how the AI voice agent behaves during conversations.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-stone-700">
                Greeting
              </label>
              <textarea
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                placeholder="Hello! I'll walk you through a few questions..."
                rows={2}
                className="mt-1 w-full resize-none rounded-xl border border-stone-200 px-4 py-3 text-sm placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700">
                Personality
              </label>
              <input
                type="text"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="Warm, professional, empathetic"
                className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-3 text-sm placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300"
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
