export function validPollInput(v: any): boolean {
  return (
    !!v &&
    (v.all === undefined || typeof v.all === "boolean") &&
    typeof v.question === "string" &&
    !!v.question.trim() &&
    v.question.trim().length <= 180 &&
    Array.isArray(v.options) &&
    v.options.length >= 2 &&
    v.options.length <= 6 &&
    v.options.every(
      (s: any) => typeof s === "string" && !!s.trim() && s.trim().length <= 100,
    ) &&
    new Set(v.options.map((s: string) => s.trim().toLocaleLowerCase("es")))
      .size === v.options.length &&
    (v.all === true ||
      (Array.isArray(v.recipients) &&
        v.recipients.length > 0 &&
        v.recipients.length <= 1000 &&
        v.recipients.every(
          (id: any) => typeof id === "string" && /^[-\w]{1,100}$/.test(id),
        )))
  );
}
export function pollResults(p: any, votes: any[], userId: string) {
  const counts = p.options.map(
    (_: string, i: number) => votes.filter((v) => v.option === i).length,
  );
  return {
    id: String(p.id),
    question: p.question,
    options: p.options,
    recipients: p.recipients,
    authorId: p.authorId,
    createdAt: p.createdAt,
    counts,
    total: counts.reduce((a: number, b: number) => a + b, 0),
    myVote: votes.find((v) => v.userId === userId)?.option,
  };
}
/** Validate browser-only demo persistence; live polls use dedicated collections. */
export function validDemoPolls(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 1000) return false;
  const id = (v: unknown) => typeof v === "string" && /^[-\w]{1,100}$/.test(v);
  return value.every(
    (p) =>
      p &&
      id(p.id) &&
      id(p.authorId) &&
      typeof p.createdAt === "string" &&
      Number.isFinite(Date.parse(p.createdAt)) &&
      validPollInput(p) &&
      Array.isArray(p.recipients) &&
      p.recipients.every(id) &&
      Array.isArray(p.votes) &&
      p.votes.length <= p.recipients.length &&
      new Set(p.votes.map((v: any) => v.userId)).size === p.votes.length &&
      p.votes.every(
        (v: any) =>
          v &&
          id(v.userId) &&
          p.recipients.includes(v.userId) &&
          Number.isInteger(v.option) &&
          v.option >= 0 &&
          v.option < p.options.length,
      ),
  );
}
