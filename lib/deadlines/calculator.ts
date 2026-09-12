export type DeadlineCalculationUnit =
  | "DAYS"
  | "WEEKS"
  | "MONTHS"
  | "YEARS";

export type DeadlineCalculationInput = {
  sourceDate: Date;
  amount: number;
  unit: DeadlineCalculationUnit;
};

export type DeadlineCalculationResult = {
  sourceDate: Date;
  dueDate: Date;
  amount: number;
  unit: DeadlineCalculationUnit;
  calculationNote: string;
};

function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function addDays(
  date: Date,
  amount: number,
): Date {
  const result = cloneDate(date);

  result.setDate(
    result.getDate() + amount,
  );

  return result;
}

function addWeeks(
  date: Date,
  amount: number,
): Date {
  return addDays(date, amount * 7);
}

function addMonths(
  date: Date,
  amount: number,
): Date {
  const result = cloneDate(date);

  const originalDay = result.getDate();

  result.setDate(1);

  result.setMonth(
    result.getMonth() + amount,
  );

  /*
   * Prevent JavaScript's Date object from
   * rolling into the following month when
   * the target month has fewer days.
   *
   * Example:
   * January 31 + 1 month should become
   * February's final valid day rather than
   * accidentally rolling into March.
   */
  const lastDayOfTargetMonth =
    new Date(
      result.getFullYear(),
      result.getMonth() + 1,
      0,
    ).getDate();

  result.setDate(
    Math.min(
      originalDay,
      lastDayOfTargetMonth,
    ),
  );

  return result;
}

function addYears(
  date: Date,
  amount: number,
): Date {
  const result = cloneDate(date);

  const originalMonth =
    result.getMonth();

  const originalDay =
    result.getDate();

  result.setDate(1);

  result.setFullYear(
    result.getFullYear() + amount,
  );

  result.setMonth(originalMonth);

  /*
   * Handle leap-year dates safely.
   *
   * Example:
   * 29 February + 1 year becomes
   * 28 February in a non-leap year.
   */
  const lastDayOfTargetMonth =
    new Date(
      result.getFullYear(),
      originalMonth + 1,
      0,
    ).getDate();

  result.setDate(
    Math.min(
      originalDay,
      lastDayOfTargetMonth,
    ),
  );

  return result;
}

export function calculateDeadline(
  input: DeadlineCalculationInput,
): DeadlineCalculationResult {
  const {
    sourceDate,
    amount,
    unit,
  } = input;

  if (!isValidDate(sourceDate)) {
    throw new Error(
      "Source date must be a valid date.",
    );
  }

  if (
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Calculation amount must be a positive whole number.",
    );
  }

  let dueDate: Date;

  switch (unit) {
    case "DAYS":
      dueDate = addDays(
        sourceDate,
        amount,
      );
      break;

    case "WEEKS":
      dueDate = addWeeks(
        sourceDate,
        amount,
      );
      break;

    case "MONTHS":
      dueDate = addMonths(
        sourceDate,
        amount,
      );
      break;

    case "YEARS":
      dueDate = addYears(
        sourceDate,
        amount,
      );
      break;

    default:
      throw new Error(
        "Unsupported deadline calculation unit.",
      );
  }

  return {
    sourceDate: cloneDate(sourceDate),
    dueDate,
    amount,
    unit,
    calculationNote:
      `Calculated by adding ${amount} ${unit.toLowerCase()} to the source date. ` +
      `This is an assisted calculation and must be verified against the applicable legal rule, ` +
      `court rule, legislation, service date and relevant public holidays before reliance.`,
  };
}

export function formatCalculationNote(
  input: DeadlineCalculationInput,
): string {
  return calculateDeadline(
    input,
  ).calculationNote;
}