import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const gameRoomSchema = new mongoose.Schema({

})

export const GameRoom = mongoose.model("GameRoom", gameRoomSchema);
export default GameRoom;