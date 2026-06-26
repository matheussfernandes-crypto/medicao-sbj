"use client";

import { useState } from "react";

export default function PasswordField({
  name,
  required,
  minLength,
  placeholder,
}: {
  name: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <input
        name={name}
        type={visivel ? "text" : "password"}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className="w-full border rounded px-3 py-2 text-sm pr-14"
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
        tabIndex={-1}
      >
        {visivel ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
