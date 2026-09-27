// Whether the screen is being rendered for a logged-out visitor.
//
// Catalogue and Book detail serve two audiences: a signed-in member, and a
// guest who may look but not act. Rather than fork the screens, they read this
// and swap the endpoint and the action bar.

import { createContext, useContext } from 'react';
import axios from 'axios';
import api, { API_ORIGIN } from '../api/axios';

// A guest must not send the auth interceptor's Authorization header.
export const publicApi = axios.create({ baseURL: API_ORIGIN + '/api' });

export const GuestContext = createContext(false);

export function useGuest() {
  return useContext(GuestContext);
}

// The pair of endpoints each screen needs, chosen once.
export function useReaderApi() {
  const guest = useGuest();
  return {
    guest,
    http: guest ? publicApi : api,
    browse: guest ? '/public/catalog' : '/catalog/browse',
    reviews: (workId) => (guest ? `/public/works/${workId}/reviews` : `/works/${workId}/reviews`),
    bookPath: (editionId) => (guest ? `/book/${editionId}` : `/app/book/${editionId}`),
    cataloguePath: guest ? '/catalogue' : '/app/catalogue',
  };
}
