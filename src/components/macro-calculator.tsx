"use client";

import { useState } from "react";

type Goal = "cut" | "maintain" | "bulk";

const ACTIVITY = [
  { key: "sedentary", label: "Desk job, little exercise", factor: 1.2 },
  { key: "light", label: "Train 1–3x a week", factor: 1.375 },
  { key: "moderate", label: "Train 3–5x a week", factor: 1.55 },
  { key: "high", label: "Train 6–7x a week", factor: 1.725 },
] as const;

const GOAL_ADJUST: Record<Goal, number> = {
  cut: -0.18,
  maintain: 0,
  bulk: 0.12,
};

/**
 * Mifflin-St Jeor BMR, scaled by activity, adjusted for goal.
 * Protein is set per kg of bodyweight, fat as a share of calories,
 * and carbohydrate takes the remainder.
 */
export function MacroCalculator() {
  const [sex, setSex] = useState<"male" | "female">("male");
  const [age, setAge] = useState(30);
  const [weight, setWeight] = useState(80);
  const [height, setHeight] = useState(178);
  const [activity, setActivity] = useState<(typeof ACTIVITY)[number]["key"]>("moderate");
  const [goal, setGoal] = useState<Goal>("cut");

  const bmr =
    10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161);
  const factor = ACTIVITY.find((a) => a.key === activity)?.factor ?? 1.55;
  const tdee = bmr * factor;
  const target = Math.round((tdee * (1 + GOAL_ADJUST[goal])) / 10) * 10;

  const proteinG = Math.round(weight * (goal === "cut" ? 2.0 : 1.8));
  const fatG = Math.round((target * 0.27) / 9);
  const carbsG = Math.max(
    0,
    Math.round((target - proteinG * 4 - fatG * 9) / 4),
  );

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold">Work out your numbers</h3>
      <p className="mt-1 text-xs text-ink-400">
        Mifflin-St Jeor, then adjusted for your goal. A starting point, not a law.
      </p>

      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Toggle
            options={[
              ["male", "Male"],
              ["female", "Female"],
            ]}
            value={sex}
            onChange={(v) => setSex(v as "male" | "female")}
          />
        </div>

        <NumberField label="Age" value={age} onChange={setAge} min={14} max={100} suffix="yrs" />
        <NumberField
          label="Weight"
          value={weight}
          onChange={setWeight}
          min={35}
          max={250}
          suffix="kg"
        />
        <NumberField
          label="Height"
          value={height}
          onChange={setHeight}
          min={120}
          max={230}
          suffix="cm"
        />

        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-300">Activity</label>
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value as typeof activity)}
            className="input"
          >
            {ACTIVITY.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-300">Goal</label>
          <Toggle
            options={[
              ["cut", "Cut"],
              ["maintain", "Maintain"],
              ["bulk", "Bulk"],
            ]}
            value={goal}
            onChange={(v) => setGoal(v as Goal)}
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-volt-500/30 bg-volt-500/5 p-4">
        <p className="text-3xl font-black tabular-nums text-volt-500">
          {target.toLocaleString()}
          <span className="text-sm font-normal text-ink-400"> kcal/day</span>
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["Protein", `${proteinG}g`],
            ["Carbs", `${carbsG}g`],
            ["Fat", `${fatG}g`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-ink-900 py-2">
              <p className="text-sm font-bold tabular-nums">{value}</p>
              <p className="text-[10px] uppercase tracking-wider text-ink-400">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-ink-400">
          Maintenance is about {Math.round(tdee / 10) * 10} kcal. Pick the plan closest
          to your target above.
        </p>
      </div>
    </div>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="col-span-2 flex gap-1 rounded-lg border border-ink-700 bg-ink-850 p-1">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            value === key
              ? "bg-volt-500 text-[var(--color-accent-fg)]"
              : "text-ink-400 hover:text-ink-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-300">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
          }}
          className="input pr-12"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">
          {suffix}
        </span>
      </div>
    </div>
  );
}
