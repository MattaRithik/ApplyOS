"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface EducationFormState {
  expected_graduation_date: string;
}

export const EMPTY_EDUCATION_STATE: EducationFormState = {
  expected_graduation_date: "",
};

export function EducationStep({
  value,
  onChange,
}: {
  value: EducationFormState;
  onChange: (patch: Partial<EducationFormState>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Expected graduation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This optional date powers your graduation countdown. You can change it later.
        </p>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs text-muted-foreground">Expected graduation date</Label>
        <Input
          type="date"
          value={value.expected_graduation_date}
          onChange={(event) => onChange({ expected_graduation_date: event.target.value })}
        />
      </div>
    </div>
  );
}
