import "dotenv/config";
import { createDb, schema } from "./index.js";
import type { FormFieldDef } from "./schema.js";

const clinicalFields: FormFieldDef[] = [
  {
    id: "name",
    label: "What is your full name?",
    type: "text",
    required: true,
  },
  {
    id: "age",
    label: "How old are you?",
    type: "number",
    required: true,
    validation: { min: 0, max: 150 },
  },
  {
    id: "reason",
    label: "What is the main reason for your visit today?",
    type: "long_text",
    required: true,
    description:
      "Let the patient describe in their own words. Ask a brief follow-up if the answer is vague.",
  },
  {
    id: "symptoms",
    label: "Which of the following symptoms are you experiencing?",
    type: "multi_select",
    required: true,
    options: [
      "Headache",
      "Fatigue",
      "Nausea",
      "Dizziness",
      "Chest pain",
      "Shortness of breath",
      "Fever",
      "Other",
    ],
    description:
      "Read the options naturally. The patient can mention multiple. If they say 'other', ask them to describe.",
  },
  {
    id: "pain_level",
    label: "On a scale from 1 to 10, how would you rate your pain right now?",
    type: "scale",
    required: true,
    validation: { min: 1, max: 10 },
    description:
      "1 means no pain at all, 10 means the worst pain imaginable.",
  },
  {
    id: "medications",
    label: "Are you currently taking any medications?",
    type: "boolean",
    required: true,
    description:
      "If yes, ask a follow-up about which medications and dosage.",
  },
  {
    id: "medication_details",
    label: "Which medications are you taking and at what dosage?",
    type: "long_text",
    required: false,
    description:
      "Only ask this if the patient answered yes to the medications question.",
  },
  {
    id: "allergies",
    label: "Do you have any known allergies?",
    type: "text",
    required: true,
    description:
      "Ask about drug allergies, food allergies, and environmental allergies.",
  },
  {
    id: "smoker",
    label: "Do you smoke or use tobacco products?",
    type: "boolean",
    required: true,
  },
  {
    id: "blood_type",
    label: "Do you know your blood type?",
    type: "enum",
    required: false,
    options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Not sure"],
  },
  {
    id: "email",
    label: "What email address should we send your visit summary to?",
    type: "email",
    required: true,
  },
];

// ── Personal Trainer Intake ──────────────────────────────────────────────────

const trainerIntakeFields: FormFieldDef[] = [
  {
    id: "name",
    label: "¿Cómo te llamas?",
    type: "text",
    required: true,
  },
  {
    id: "goal",
    label: "¿Qué quieres lograr con el entrenamiento?",
    type: "long_text",
    required: true,
    description:
      "Deja que se explayen — esta es LA pregunta. Si la respuesta es genérica ('ponerme en forma'), pregunta un follow-up breve: '¿Hay algo específico que te motivó a buscar un entrenador ahora?'",
  },
  {
    id: "experience",
    label: "¿Has entrenado antes? ¿Qué estás haciendo actualmente?",
    type: "long_text",
    required: true,
    description:
      "Combina historial y actividad actual en una sola pregunta. Si nunca han entrenado, no insistas — pasa a la siguiente.",
  },
  {
    id: "injuries",
    label: "¿Tienes alguna lesión, dolor crónico o limitación física que deba saber?",
    type: "long_text",
    required: true,
    description:
      "Pregunta con naturalidad, sin tono clínico. Si dicen que no, perfecto — no pidas más detalle.",
  },
  {
    id: "days_per_week",
    label: "¿Cuántos días por semana puedes entrenar?",
    type: "number",
    required: true,
    validation: { min: 1, max: 7 },
    description:
      "Si mencionan un rango ('3 o 4'), guarda el número menor. Pregunta brevemente cuánto tiempo por sesión si lo mencionan.",
  },
  {
    id: "expectations",
    label: "¿Qué esperas de trabajar con un entrenador?",
    type: "long_text",
    required: true,
    description:
      "Buena pregunta de cierre. Algunos quieren solo rutinas, otros quieren accountability, nutrición, etc. Deja que hablen.",
  },
];

async function seed() {
  const db = createDb();

  // ── Clinical intake ─────────────────────────────────────────────────────────
  console.log("Seeding clinical intake form...");

  const [form] = await db
    .insert(schema.forms)
    .values({
      slug: "clinical-intake",
      title: "Clinical Intake Form",
      description:
        "A voice-guided clinical intake that collects patient information conversationally.",
      fields: clinicalFields,
      greeting:
        "Hello, welcome to your intake appointment. I'll walk you through a few questions about your health — just answer naturally and take your time.",
      systemContext: [
        "You are a warm, professional clinical intake assistant.",
        "You are collecting medical information from a patient before their appointment.",
        "Be empathetic and patient. Some questions may be sensitive.",
        "If the patient asks what a term means, explain it in simple language.",
        "You are NOT a doctor and cannot diagnose. If asked for medical advice, kindly remind them that a healthcare professional will review their information.",
        "For the medications question: if they say yes, proceed to ask about details. If no, skip the medication_details field.",
        "For multi-select questions, read the options naturally (not as a numbered list) and let the patient pick.",
      ].join("\n"),
      personality: "Warm, professional, empathetic, patient, clear",
      language: "en",
    })
    .returning();

  console.log(`Created form: ${form.title} (slug: ${form.slug})`);
  console.log(`Public URL: /f/${form.slug}`);

  // ── Personal Trainer intake ─────────────────────────────────────────────────
  console.log("Seeding personal trainer intake form...");

  const [trainerForm] = await db
    .insert(schema.forms)
    .values({
      slug: "trainer-intake",
      title: "Intake — Entrenador Personal",
      description:
        "Formulario de primer acercamiento entre un entrenador personal y un nuevo cliente. Recoge objetivos, experiencia, limitaciones y expectativas por voz.",
      fields: trainerIntakeFields,
      greeting:
        "¡Hola! Soy el asistente de tu entrenador. Antes de empezar, quiero conocerte un poco para que podamos armar algo que realmente te funcione. Son solo unas preguntas rápidas — contesta como quieras, sin presión.",
      systemContext: [
        "Eres el asistente de intake de un entrenador personal.",
        "Tu trabajo es recoger información clave de un nuevo cliente para que el entrenador pueda diseñar su primer programa.",
        "Habla en español, de forma cercana y motivadora — como un coach amigable, no como un formulario.",
        "Si el cliente parece nervioso o inseguro sobre su nivel, normaliza: 'No te preocupes, todos empezamos por algún lado.'",
        "NO des consejos de entrenamiento ni nutrición — solo recoges info.",
        "Si mencionan una lesión o condición médica seria, valida: 'Gracias por contarme, el entrenador va a tener esto en cuenta.'",
        "Mantén las transiciones naturales entre preguntas. No digas 'siguiente pregunta'.",
      ].join("\n"),
      personality: "Cercano, motivador, conciso, empático, deportivo",
      language: "es",
    })
    .returning();

  console.log(`Created form: ${trainerForm.title} (slug: ${trainerForm.slug})`);
  console.log(`Public URL: /f/${trainerForm.slug}`);

  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
