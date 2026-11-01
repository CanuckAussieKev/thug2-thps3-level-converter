// NOT ORIGINAL - THPS3's skinned models (.SKN) and animations (.ska), read and made THUG2's (phase 2 of the ped models:
// THPS3's own people in the THPS3 port).
//
// .SKN - a RenderWare 3.1 clump (thps3.ts's chunks):
//   frame list: per frame a 3 x 3 rotation (rows right / up / at: a point p maps to p.x * right + p.y * up + p.z * at +
//     position), the position, the parent frame; each frame's extension holds Neversoft's bone chunk (0x108): i32 the
//     bone's number (-1: a frame that isn't a bone - the ends of the limbs), then data not used here. Frame 0 is the
//     model's root (rows (1,0,0), (0,0,-1), (0,1,0): the bones' z-up space turned y-up), frame 1 bone 0. Every bone
//     frame has an identity rotation: the rig is positions only.
//   one geometry (positions, normals, uvs, the material list, a bin mesh of strips per material) and one atomic whose
//     extension holds RenderWare's skin (0x116): u32 bones, u32 vertices, per vertex 4 x u8 bone numbers, per vertex
//     4f weights, per bone 76 bytes {u32 its number, u32 its number, u32 flags, 4 x 4f the inverse bind matrix (rows,
//     the fourth float of each not used: garbage in the files), the translation row last}.
//   The geometry's vertices are in bone 0's space (z up, the origin at the pelvis).
// .ska - Neversoft's RenderWare animation:
//   u32 (a number per file, not used), u32 0x80000000, f32 duration (seconds), u32 rotation keys, u32 translation keys,
//   the rotation keys {4f quaternion x y z w, f32 time, u32 the previous key's offset in the rotation keys (bytes)},
//   the translation keys {3f, f32 time, u32 the previous key's offset}. The first key of each track is the bone's at
//   time 0, in bone order (as RenderWare streams them); a later key's bone is its previous key's. Rotations and
//   translations are the bone's local transform (relative to its parent bone), as THUG2's.
//
// Quaternions: THPS3's and THUG2's are stored the same way - a stored (x, y, z, w) turns a point by its conjugate
// (measured: THUG2's THPS6_human rest pose places its bones where Ped_Construction's skin has them only that way, and
// THPS3's walk bends the knees backwards only that way). The maths below is in the usual (Hamilton) sense: conj() at the
// files' edges.

import { FormatError, Reader, Writer } from "thug2-level-converter-core/level_port/binio.ts";
import { checksum } from "thug2-level-converter-core/level_port/qb.ts";
import {
    ANIM_FLAGS,
    conj,
    FPS,
    IDENTITY,
    matrixQuat,
    normalize,
    type Quat,
    qmul,
    type RotationKey,
    readAnim,
    readSkeleton,
    rotate,
    type SkeletonBone,
    type Track,
    type TranslationKey,
    type Vec,
    writeAnim,
    writeSkeleton,
} from "thug2-level-converter-core/level_port/thug2_skeleton.ts";
import * as thps3 from "./thps3.ts";

// (THUG2's skeleton and animation formats and the quaternion maths: core's level_port/thug2_skeleton.ts since the
// converters' dependencies followed their engines - re-exported for this converter's users)
export {
    ANIM_FLAGS,
    conj,
    FPS,
    IDENTITY,
    matrixQuat,
    normalize,
    type Quat,
    qmul,
    type RotationKey,
    readAnim,
    readSkeleton,
    rotate,
    type SkeletonBone,
    type Track,
    type TranslationKey,
    type Vec,
    writeAnim,
    writeSkeleton,
};

const SKIN = 0x116;
const BONE = 0x108;

// --- .SKN ----------------------------------------------------------------------------------------------------------

export interface SknBone {
    frame: number; // its frame in the clump
    parent: number; // its parent bone (-1: none - bone 0)
    // the bind pose (the inverse bind matrix inverted), in the geometry's space
    position: Vec;
    rotation: Quat;
}

export interface SknPart {
    geometry: thps3.Geometry;
    // per vertex of the geometry
    vertexBones: number[][]; // 4 bone numbers
    vertexWeights: number[][]; // 4 weights
}

export interface Skn {
    clump: thps3.Clump;
    root: Quat; // the root frame's rotation (bone 0's parent: bone 0's space into the model's, y up)
    bones: SknBone[];
    parts: SknPart[]; // per atomic (the pros: the body, the board)
}

function findChunk(data: Buffer, start: number, end: number, kind: number, name: string): thps3.Chunk | null {
    for (const c of thps3.children(data, start, end, name)) {
        if (c[0] === kind) return c;
        if (c[0] === thps3.EXTENSION) {
            const inner = findChunk(data, c[1], c[1] + c[2], kind, name);
            if (inner !== null) return inner;
        }
    }
    return null;
}

export function readSkn(data: Buffer, name = "skn"): Skn {
    const [clump, end] = thps3.readClump(data, 0, name);
    // (the frames' bone numbers and the atomics' skins: walked again from the clump's chunks - to the end readClump
    // found: the clump's declared size leaves out its extension's Neversoft header, as the .dff's)
    const kids = thps3.children(data, 12, end, name);
    const frameList = kids.find((k) => k[0] === thps3.FRAMELIST);
    const atomics = kids.filter((k) => k[0] === thps3.ATOMIC);
    if (frameList === undefined || !atomics.length) throw new FormatError(`${name}: no frame list / atomic`);
    const boneOfFrame: number[] = [];
    for (const [kind, o, n] of thps3.children(data, frameList[1], frameList[1] + frameList[2], name)) {
        if (kind !== thps3.EXTENSION) continue;
        const bone = n ? findChunk(data, o, o + n, BONE, name) : null;
        boneOfFrame.push(bone !== null && bone[2] >= 4 ? data.readInt32LE(bone[1]) : -1);
    }
    if (boneOfFrame.length !== clump.frames.length)
        throw new FormatError(`${name}: ${boneOfFrame.length} frame extensions for ${clump.frames.length} frames`);
    let bones: SknBone[] | null = null;
    const parts: SknPart[] = [];
    for (const [k, atomic] of atomics.entries()) {
        const skin = findChunk(data, atomic[1], atomic[1] + atomic[2], SKIN, name);
        if (skin === null) throw new FormatError(`${name}: atomic ${k} has no skin`);
        const geometry = clump.geometries[clump.atomics[k]!.geometry];
        if (geometry === undefined) throw new FormatError(`${name}: atomic ${k}'s geometry`);
        const r = new Reader(data.subarray(skin[1], skin[1] + skin[2]), 0, name);
        const boneCount = r.u32();
        const vertexCount = r.u32();
        if (vertexCount !== geometry.positions.length)
            throw new FormatError(`${name}: skin of ${vertexCount} vertices, geometry of ${geometry.positions.length}`);
        const vertexBones: number[][] = [];
        for (let v = 0; v < vertexCount; v++) vertexBones.push(r.read("4B"));
        const vertexWeights: number[][] = [];
        for (let v = 0; v < vertexCount; v++) vertexWeights.push(r.read("4f"));
        const these: SknBone[] = [];
        for (let b = 0; b < boneCount; b++) {
            r.read("3I");
            const m = r.read("16f");
            // (the inverse of the bind pose: a point's p.x * row 0 + p.y * row 1 + p.z * row 2 + row 3)
            const inverse = matrixQuat([m[0]!, m[1]!, m[2]!, m[4]!, m[5]!, m[6]!, m[8]!, m[9]!, m[10]!]);
            const rotation = conj(inverse);
            const position = rotate(rotation, [m[12]!, m[13]!, m[14]!]).map((x) => -x) as Vec;
            const frame = boneOfFrame.indexOf(b);
            if (frame < 0) throw new FormatError(`${name}: no frame for bone ${b}`);
            these.push({ frame, parent: -1, position, rotation });
        }
        r.expectEnd();
        for (const v of vertexBones) for (const b of v) if (b >= boneCount) throw new FormatError(`${name}: bone ${b}`);
        if (bones === null) bones = these;
        else if (
            these.length !== bones.length ||
            these.some((b, i) => b.position.some((x, j) => Math.abs(x - bones![i]!.position[j]!) > 1e-3))
        )
            throw new FormatError(`${name}: atomic ${k}'s skin has other bones`);
        parts.push({ geometry, vertexBones, vertexWeights });
    }
    for (const bone of bones!) {
        let f = clump.frames[bone.frame]!.parent;
        while (f >= 0 && boneOfFrame[f]! < 0) f = clump.frames[f]!.parent;
        bone.parent = f >= 0 ? boneOfFrame[f]! : -1;
    }
    for (const [b, bone] of bones!.entries()) {
        if (bone.parent >= b) throw new FormatError(`${name}: bone ${b}'s parent ${bone.parent} comes after it`);
        if (bone.parent < 0 !== (b === 0)) throw new FormatError(`${name}: bone ${b} is a root`);
    }
    const rootFrame = clump.frames[bones![0]!.frame]!.parent;
    if (rootFrame < 0) throw new FormatError(`${name}: bone 0 has no root frame`);
    return { clump, root: matrixQuat(clump.frames[rootFrame]!.rotation), bones: bones!, parts };
}

// --- .ska ----------------------------------------------------------------------------------------------------------

export interface Ska {
    duration: number;
    rotations: RotationKey[][]; // per bone, in time order
    translations: TranslationKey[][];
}

export function readSka(data: Buffer, bones: number, name = "ska"): Ska {
    const r = new Reader(data, 0, name);
    const [, flags] = r.read("2I") as [number, number];
    const duration = r.f32();
    const [nq, nt] = r.read("2I") as [number, number];
    if (flags !== 0x80000000 || nq < bones || nt < bones || data.length !== 20 + 24 * nq + 20 * nt)
        throw new FormatError(`${name}: not an animation of ${bones} bones`);
    const rotations: RotationKey[][] = Array.from({ length: bones }, () => []);
    const owner: number[] = [];
    for (let i = 0; i < nq; i++) {
        const [x, y, z, w, time] = r.read("5f") as [number, number, number, number, number];
        const prev = r.i32();
        const b = i < bones ? i : owner[prev / 24];
        if (b === undefined || (i >= bones && (prev % 24 || prev / 24 >= i)))
            throw new FormatError(`${name}: rotation key ${i}'s previous key ${prev}`);
        owner.push(b);
        rotations[b]!.push({ time, q: conj(normalize([x, y, z, w])) });
    }
    const translations: TranslationKey[][] = Array.from({ length: bones }, () => []);
    const owner2: number[] = [];
    for (let i = 0; i < nt; i++) {
        const [x, y, z, time] = r.read("4f") as [number, number, number, number];
        const prev = r.i32();
        const b = i < bones ? i : owner2[prev / 20];
        if (b === undefined || (i >= bones && (prev % 20 || prev / 20 >= i)))
            throw new FormatError(`${name}: translation key ${i}'s previous key ${prev}`);
        owner2.push(b);
        translations[b]!.push({ time, t: [x, y, z] });
    }
    r.expectEnd();
    for (const track of [...rotations, ...translations]) {
        for (let k = 1; k < track.length; k++) {
            if (track[k]!.time < track[k - 1]!.time) throw new FormatError(`${name}: keys out of time order`);
        }
    }
    return { duration, rotations, translations };
}
