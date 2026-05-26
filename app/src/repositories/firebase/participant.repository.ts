import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Participant } from "@/types";
import { ParticipantRepository } from "../interfaces";

export class FirebaseParticipantRepository implements ParticipantRepository {
  private getRef(scheduleId: string) {
    return collection(db, "schedules", scheduleId, "participants");
  }

  async getAll(scheduleId: string): Promise<Participant[]> {
    const snapshot = await getDocs(this.getRef(scheduleId));
    return snapshot.docs.map((doc) =>
      this.toParticipant(doc.id, doc.data())
    );
  }

  async get(
    scheduleId: string,
    memberId: string
  ): Promise<Participant | null> {
    const docRef = doc(db, "schedules", scheduleId, "participants", memberId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return this.toParticipant(snapshot.id, snapshot.data());
  }

  async add(scheduleId: string, participant: Participant): Promise<void> {
    const docRef = doc(
      db,
      "schedules",
      scheduleId,
      "participants",
      participant.memberId
    );
    await setDoc(docRef, this.toFirestore(participant));
  }

  async update(
    scheduleId: string,
    memberId: string,
    data: Partial<Participant>
  ): Promise<void> {
    const docRef = doc(db, "schedules", scheduleId, "participants", memberId);
    const firestoreData: Record<string, unknown> = {};

    if (data.status !== undefined) firestoreData.status = data.status;
    if (data.gamesPlayed !== undefined)
      firestoreData.gamesPlayed = data.gamesPlayed;
    if (data.joinedAt !== undefined)
      firestoreData.joinedAt = data.joinedAt
        ? Timestamp.fromDate(data.joinedAt)
        : null;
    if (data.leftAt !== undefined)
      firestoreData.leftAt = data.leftAt
        ? Timestamp.fromDate(data.leftAt)
        : null;
    if (data.lastGameEndedAt !== undefined)
      firestoreData.lastGameEndedAt = data.lastGameEndedAt
        ? Timestamp.fromDate(data.lastGameEndedAt)
        : null;

    await updateDoc(docRef, firestoreData);
  }

  async remove(scheduleId: string, memberId: string): Promise<void> {
    const docRef = doc(db, "schedules", scheduleId, "participants", memberId);
    await deleteDoc(docRef);
  }

  private toParticipant(
    memberId: string,
    data: Record<string, unknown>
  ): Participant {
    return {
      memberId,
      status: data.status as Participant["status"],
      joinedAt: (data.joinedAt as Timestamp)?.toDate() ?? null,
      leftAt: (data.leftAt as Timestamp)?.toDate() ?? null,
      gamesPlayed: (data.gamesPlayed as number) ?? 0,
      lastGameEndedAt: (data.lastGameEndedAt as Timestamp)?.toDate() ?? null,
    };
  }

  private toFirestore(participant: Participant): Record<string, unknown> {
    return {
      memberId: participant.memberId,
      status: participant.status,
      joinedAt: participant.joinedAt
        ? Timestamp.fromDate(participant.joinedAt)
        : null,
      leftAt: participant.leftAt
        ? Timestamp.fromDate(participant.leftAt)
        : null,
      gamesPlayed: participant.gamesPlayed,
      lastGameEndedAt: participant.lastGameEndedAt
        ? Timestamp.fromDate(participant.lastGameEndedAt)
        : null,
    };
  }
}
