import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Game } from "@/types";
import { GameRepository } from "../interfaces";

export class FirebaseGameRepository implements GameRepository {
  private getRef(scheduleId: string) {
    return collection(db, "schedules", scheduleId, "games");
  }

  async getAll(scheduleId: string): Promise<Game[]> {
    const q = query(this.getRef(scheduleId), orderBy("startedAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => this.toGame(doc.id, doc.data()));
  }

  async getById(scheduleId: string, gameId: string): Promise<Game | null> {
    const docRef = doc(db, "schedules", scheduleId, "games", gameId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return this.toGame(snapshot.id, snapshot.data());
  }

  async create(scheduleId: string, game: Omit<Game, "id">): Promise<Game> {
    const docRef = await addDoc(this.getRef(scheduleId), {
      ...game,
      startedAt: game.startedAt ? Timestamp.fromDate(game.startedAt) : null,
      endedAt: game.endedAt ? Timestamp.fromDate(game.endedAt) : null,
    });
    return {
      id: docRef.id,
      ...game,
    };
  }

  async update(
    scheduleId: string,
    gameId: string,
    data: Partial<Omit<Game, "id">>
  ): Promise<void> {
    const docRef = doc(db, "schedules", scheduleId, "games", gameId);
    const firestoreData: Record<string, unknown> = {};

    if (data.status !== undefined) firestoreData.status = data.status;
    if (data.courtNumber !== undefined)
      firestoreData.courtNumber = data.courtNumber;
    if (data.team1 !== undefined) firestoreData.team1 = data.team1;
    if (data.team2 !== undefined) firestoreData.team2 = data.team2;
    if (data.startedAt !== undefined)
      firestoreData.startedAt = data.startedAt
        ? Timestamp.fromDate(data.startedAt)
        : null;
    if (data.endedAt !== undefined)
      firestoreData.endedAt = data.endedAt
        ? Timestamp.fromDate(data.endedAt)
        : null;

    await updateDoc(docRef, firestoreData);
  }

  async delete(scheduleId: string, gameId: string): Promise<void> {
    const docRef = doc(db, "schedules", scheduleId, "games", gameId);
    await deleteDoc(docRef);
  }

  async getActiveGames(scheduleId: string): Promise<Game[]> {
    const q = query(
      this.getRef(scheduleId),
      where("status", "in", ["waiting", "in_progress"])
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => this.toGame(doc.id, doc.data()));
  }

  private toGame(id: string, data: Record<string, unknown>): Game {
    return {
      id,
      courtNumber: data.courtNumber as number,
      status: data.status as Game["status"],
      team1: data.team1 as [string, string],
      team2: data.team2 as [string, string],
      startedAt: (data.startedAt as Timestamp)?.toDate() ?? null,
      endedAt: (data.endedAt as Timestamp)?.toDate() ?? null,
    };
  }
}
