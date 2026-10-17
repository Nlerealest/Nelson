// App-wide state: the saved data, today's date, the open form sheet and toasts.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { toDateKey } from './logic';
import { emptyData, load, save } from './storage';
import { scheduleReminders } from './reminders';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [today, setToday] = useState(toDateKey(new Date()));
  const [sheet, setSheet] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef(null);

  // Latest data for event handlers, so quick successive updates build on each other.
  const dataRef = useRef(null);

  useEffect(() => {
    load().then((loaded) => {
      dataRef.current = loaded;
      setData(loaded);
    });
  }, []);

  // Refresh "today" when the app comes back to the foreground on a new day.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(toDateKey(new Date()));
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (data) scheduleReminders(data, today);
  }, [data, today]);

  const toast = useCallback((message) => {
    setToastMessage(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(''), 2400);
  }, []);

  const commit = useCallback(
    (next, message) => {
      dataRef.current = next;
      setData(next);
      save(next).then((ok) => {
        if (!ok) toast('Could not save. Your phone storage may be full.');
        else if (message) toast(message);
      });
    },
    [toast],
  );

  // Apply a change to a copy of the data and save it. `change` may mutate the copy.
  const update = useCallback(
    (change, message) => {
      const next = JSON.parse(JSON.stringify(dataRef.current || emptyData()));
      change(next);
      commit(next, message);
    },
    [commit],
  );

  const value = {
    data: data || emptyData(),
    loaded: !!data,
    today,
    update,
    replace: commit,
    sheet,
    openSheet: (name, props = {}) => setSheet({ name, props }),
    closeSheet: () => setSheet(null),
    toast,
    toastMessage,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
