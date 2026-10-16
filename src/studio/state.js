export function createStudioState(initialProject) {
  let project = initialProject;
  const listeners = new Set();
  return {
    getProject: () => project,
    setProject(next, reason = "replace") {
      project = next;
      listeners.forEach((listener) => listener(project, reason));
      return project;
    },
    update(mutator, reason = "update") {
      mutator(project);
      listeners.forEach((listener) => listener(project, reason));
      return project;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

export const selectActiveClip = (project) => project.clip;
export const selectAssets = (project) => project.assets || [];
export const selectLayers = (project) => project.parts || [];
