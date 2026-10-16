export function createCommandBus({ getProject, setProject, history, persist, notify = (_label) => {} }) {
  function commit(label, { immediate = false } = {}) {
    const project = getProject();
    const recorded = history.record(label, project);
    setProject(project, label);
    persist(project, { immediate });
    notify(label);
    return recorded;
  }

  async function execute(label, mutation, { immediate = false } = {}) {
    const project = getProject();
    await mutation(project);
    history.record(label, project);
    setProject(project, label);
    await persist(project, { immediate });
    notify(label);
    return project;
  }

  function undo() {
    const result = history.undo(getProject());
    if (!result) return null;
    setProject(result.project, `undo:${result.label}`);
    persist(result.project, { immediate: false });
    return result;
  }

  function redo() {
    const result = history.redo(getProject());
    if (!result) return null;
    setProject(result.project, `redo:${result.label}`);
    persist(result.project, { immediate: false });
    return result;
  }

  return { commit, execute, undo, redo };
}
