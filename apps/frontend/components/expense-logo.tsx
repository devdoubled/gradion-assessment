export function ExpenseLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Expense Report logo"
    >
      {/* Rounded background square */}
      <rect width="100" height="100" rx="18" fill="#F15A29" />
      {/* Stylised geometric E */}
      <path
        d="M28 20 H72 V34 H44 V46 H68 V60 H44 V72 H72 V86 H28 Z"
        fill="white"
      />
    </svg>
  );
}
