/** Estado de una solicitud de amistad a lo largo de su ciclo de vida. */
export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

/** Solicitud de amistad pendiente recibida, con el username de quien la envió. */
export interface ReceivedFriendRequest {
  id: string;
  fromUsername: string;
  createdAt: string;
}

/** Solicitud de amistad enviada, con su estado actual. */
export interface SentFriendRequest {
  id: string;
  toUsername: string;
  status: FriendRequestStatus;
  createdAt: string;
}

/** Amigo ya aceptado, identificado por su username. */
export interface Friend {
  username: string;
}
