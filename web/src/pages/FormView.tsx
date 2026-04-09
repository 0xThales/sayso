import { useParams } from "react-router";

export function FormView() {
  const { id } = useParams<{ id: string }>();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <p className="text-stone-500">Form: {id}</p>
    </main>
  );
}
