import { useEffect, useState } from 'react';
import { getAuth, subscribe, hydrate } from '../lib/auth';

export function useAuth() {
  const [auth, setAuth] = useState(getAuth);

  useEffect(() => {
    hydrate();
    return subscribe(setAuth);
  }, []);

  return auth;
}

export function useIsAdmin() {
  const { user } = useAuth();
  const role = user?.role;
  return role === 'admin' || role === 'doctor' || role === 'superadmin';
}
