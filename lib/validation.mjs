export function text(value, label, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new Error(`${label} must contain ${min}–${max} characters.`);
  return value.trim();
}
export function taskInput(input) {
  if (!input || !Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 6) throw new Error('Add between one and six source notes.');
  const sources = input.sources.map((source) => ({ title: text(source.title, 'Source title', 1, 100), content: text(source.content, 'Source note', 10, 12000) }));
  if (sources.reduce((sum, source) => sum + source.content.length, 0) > 36000) throw new Error('Keep all source notes under 36,000 characters.');
  return { title: text(input.title, 'Task title', 3, 100), prompt: text(input.prompt, 'Task brief', 12, 3000), sources };
}
export function skillInput(input) {
  return { title: text(input.title, 'Skill title', 3, 80), instructions: text(input.instructions, 'Skill instructions', 12, 2000) };
}
export function safeName(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,70}\.md$/.test(name)) throw new Error('Report names must be a simple .md filename.');
  return name;
}
