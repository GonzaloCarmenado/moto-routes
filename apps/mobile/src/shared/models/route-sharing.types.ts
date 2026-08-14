/** Estado de una invitación de compartir a lo largo de su ciclo de vida. */
export type RouteShareStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

/** Invitación pendiente recibida, con el resumen de ruta suficiente para decidir sin aceptarla primero. */
export interface ReceivedRouteShareInvitation {
  id: string;
  routeId: string;
  routeName: string | null;
  routeCreatedAt: string;
  fromEmail: string;
  createdAt: string;
}

/** Invitación enviada, con su estado actual. */
export interface SentRouteShareInvitation {
  id: string;
  routeId: string;
  routeName: string | null;
  routeCreatedAt: string;
  toEmail: string;
  status: RouteShareStatus;
  createdAt: string;
}
