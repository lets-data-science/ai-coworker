/** Snapshots prevent later skill edits from rewriting a past task's history. */
export function selectSkills(allSkills, selectedIds) {
  if (!Array.isArray(selectedIds) || selectedIds.length > 3) throw new Error('Choose no more than three skills.');
  if (new Set(selectedIds).size !== selectedIds.length) throw new Error('Each skill may be selected once.');
  return selectedIds.map((id) => {
    const skill = allSkills.find((item) => item.id === id);
    if (!skill || !skill.approved) throw new Error('A selected skill is missing or not approved.');
    return { id: skill.id, title: skill.title, instructions: skill.instructions, version: skill.version };
  });
}
