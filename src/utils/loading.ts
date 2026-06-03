const DEFAULT_MINIMUM_LOADING_MS = 1000;

export async function withMinimumLoadingTime<T>(
  work: Promise<T>,
  minimumMs = DEFAULT_MINIMUM_LOADING_MS,
): Promise<T> {
  const [result] = await Promise.all([
    work,
    new Promise(resolve => {
      setTimeout(resolve, minimumMs);
    }),
  ]);

  return result;
}
