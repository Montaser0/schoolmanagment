import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputFieldError = {
  message?: string;
};

type InputFieldProps = {
  label?: string;
  type?: string;
  register?: (name: string) => Record<string, unknown>;
  name: string;
  defaultValue?: string;
  error?: InputFieldError;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  width?: "1/4" | "1/3" | "1/2" | "2/3" | "3/4" | "full";
  containerClassName?: string;
  inputClassName?: string;
};

const InputField = ({
  label,
  type = "text",
  register,
  name,
  defaultValue,
  error,
  inputProps,
  width = "1/4",
  containerClassName,
  inputClassName,
}: InputFieldProps) => {
  const widthClass = {
    "1/4": "w-full md:w-1/4",
    "1/3": "w-full md:w-1/3",
    "1/2": "w-full md:w-1/2",
    "2/3": "w-full md:w-2/3",
    "3/4": "w-full md:w-3/4",
    "full": "w-full",
  };

  return (
    <div className={cn("flex flex-col gap-2", widthClass[width], containerClassName)}>
      {label ? <label className="text-xs text-gray-500">{label}</label> : null}
      <input
        type={type}
        {...(register ? register(name) : {})}
        name={name}
        className={cn("ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full", inputClassName, inputProps?.className)}
        {...inputProps}
        defaultValue={defaultValue}
      />
      {error?.message && (
        <p className="text-xs text-red-400">{error.message.toString()}</p>
      )}
    </div>
  );
};

export default InputField;
