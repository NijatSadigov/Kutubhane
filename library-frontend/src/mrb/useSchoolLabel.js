// The school label the design shows in two places: the header pill
// ("Hədəf · Nizami Branch") and the Catalogue's eyebrow above the title. The
// prototype calls them `schoolLabel` and `branchShort`.
//
// Both screens used to fetch this separately; keeping it in one hook means the
// header and the page body can never disagree about which library you are in.

import { useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';

export function useSchoolLabel() {
  const { user } = useContext(AuthContext);
  const [state, setState] = useState({ label: '', short: '' });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/public/stats');
        const school = (res.data.schools || [])[0];
        if (!alive || !school) return;
        const branch = user?.student?.branch?.name || user?.librarian?.branch?.name || '';
        setState({
          // A school with one branch is named by itself; naming the branch as
          // well would be noise.
          label: school.branches > 1 && branch ? `${school.name} · ${branch}` : school.name,
          short: branch || school.name,
        });
      } catch { /* decorative — stay silent */ }
    })();
    return () => { alive = false; };
  }, [user]);

  return state;
}

export default useSchoolLabel;
