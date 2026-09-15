import { InputHTMLAttributes } from "react";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function FormField({
  label,
  error,
  id,
  className = "",
  ...props
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        className={`rounded-2xl border px-4 py-3 text-slate-800 outline-none transition focus:border-slate-800 ${
          error ? "border-[#e88f95]" : "border-slate-300"
        } ${className}`}
        {...props}
      />
      {error && (
        <p className="text-sm font-semibold text-[#e88f95]">{error}</p>
      )}
    </div>
  );
}
