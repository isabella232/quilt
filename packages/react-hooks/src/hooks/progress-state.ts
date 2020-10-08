import {useState} from 'react';

export function useAsyncActionState<T>(
  event: () => Promise<T>,
): [boolean, () => Promise<T>] {
  const [inProgress, setInProgress] = useState(false);
  async function handleEvent() {
    try {
      setInProgress(true);
      return await event();
    } finally {
      setInProgress(false);
    }
  }
  return [inProgress, handleEvent];
}
