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

async function seed() {
  const db = createDb();

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
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
