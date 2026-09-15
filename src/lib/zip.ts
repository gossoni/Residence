import { deflateRawSync } from "node:zlib";

/* ------------------------------------------------------------------ */
/*                                                                     */
/*  Générateur ZIP autonome — AUCUNE DÉPENDANCE EXTERNE                */
/*                                                                     */
/*  Implémente le format ZIP (PKWARE APPNOTE) avec les seuls modules   */
/*  natifs de Node (`node:zlib` pour DEFLATE).                         */
/*                                                                     */
/*  Motif : la dépendance `jszip` provoquait « Module not found »      */
/*  lorsque le code était récupéré sans réinstaller les paquets.       */
/*  Ce module supprime définitivement ce risque.                       */
/*                                                                     */
/* ------------------------------------------------------------------ */

/** Table CRC-32 (polynôme 0xEDB88320), calculée une seule fois. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Convertit une date en couple (heure DOS, date DOS). */
function dosDateTime(d: Date): { time: number; date: number } {
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    ((Math.floor(d.getSeconds() / 2) & 0x1f) >>> 0);
  const date =
    (((d.getFullYear() - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0x0f) << 5) |
    (d.getDate() & 0x1f);
  return { time: time & 0xffff, date: date & 0xffff };
}

type Entry = {
  name: string;
  data: Buffer;
  crc: number;
  compressed: Buffer;
  method: number; // 0 = stocké, 8 = deflate
  time: number;
  date: number;
  offset: number;
};

/** Niveau de compression DEFLATE (0 à 9). */
const DEFLATE_LEVEL = 6;

export class ZipWriter {
  private entries: Entry[] = [];
  private now = new Date();

  /**
   * Ajoute un fichier. `name` est le chemin complet dans l'archive,
   * avec des séparateurs `/` (ex. « utilisateur/profil.json »).
   */
  addFile(name: string, content: string | Buffer): this {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const crc = crc32(data);

    // DEFLATE uniquement si cela réduit réellement la taille.
    let compressed = data;
    let method = 0;
    if (data.length > 0) {
      const deflated = deflateRawSync(data, { level: DEFLATE_LEVEL });
      if (deflated.length < data.length) {
        compressed = deflated;
        method = 8;
      }
    }

    const { time, date } = dosDateTime(this.now);
    // Nom de fichier encodé en UTF-8 (flag 0x0800).
    this.entries.push({
      name: name.replace(/\\/g, "/"),
      data,
      crc,
      compressed,
      method,
      time,
      date,
      offset: 0,
    });
    return this;
  }

  /** Construit l'archive ZIP complète. */
  build(): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;

    for (const entry of this.entries) {
      const nameBuf = Buffer.from(entry.name, "utf8");
      entry.offset = offset;

      // ----- En-tête local (30 octets + nom) -----
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0); // signature « PK\x03\x04 »
      local.writeUInt16LE(20, 4); // version minimale (2.0)
      local.writeUInt16LE(0x0800, 6); // flags : noms UTF-8
      local.writeUInt16LE(entry.method, 8); // méthode de compression
      local.writeUInt16LE(entry.time, 10); // heure DOS
      local.writeUInt16LE(entry.date, 12); // date DOS
      local.writeUInt32LE(entry.crc, 14); // CRC-32
      local.writeUInt32LE(entry.compressed.length, 18); // taille compressée
      local.writeUInt32LE(entry.data.length, 22); // taille originale
      local.writeUInt16LE(nameBuf.length, 26); // longueur du nom
      local.writeUInt16LE(0, 28); // pas de champ extra

      localParts.push(local, nameBuf, entry.compressed);

      // ----- En-tête du répertoire central (46 octets + nom) -----
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0); // signature « PK\x01\x02 »
      central.writeUInt16LE(20, 4); // version créateur
      central.writeUInt16LE(20, 6); // version minimale
      central.writeUInt16LE(0x0800, 8); // flags UTF-8
      central.writeUInt16LE(entry.method, 10); // méthode
      central.writeUInt16LE(entry.time, 12);
      central.writeUInt16LE(entry.date, 14);
      central.writeUInt32LE(entry.crc, 16);
      central.writeUInt32LE(entry.compressed.length, 20);
      central.writeUInt32LE(entry.data.length, 24);
      central.writeUInt16LE(nameBuf.length, 28); // longueur du nom
      central.writeUInt16LE(0, 30); // extra
      central.writeUInt16LE(0, 32); // commentaire
      central.writeUInt16LE(0, 34); // disque de départ
      central.writeUInt16LE(0, 36); // attributs internes
      central.writeUInt32LE(0, 38); // attributs externes
      central.writeUInt32LE(entry.offset, 42); // décalage de l'en-tête local

      centralParts.push(central, nameBuf);

      offset += local.length + nameBuf.length + entry.compressed.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); // signature « PK\x05\x06 »
    end.writeUInt16LE(0, 4); // numéro de disque
    end.writeUInt16LE(0, 6); // disque contenant le répertoire
    end.writeUInt16LE(this.entries.length, 8); // entrées sur ce disque
    end.writeUInt16LE(this.entries.length, 10); // total des entrées
    end.writeUInt32LE(centralDirectory.length, 12); // taille du répertoire
    end.writeUInt32LE(offset, 16); // décalage du répertoire
    end.writeUInt16LE(0, 20); // longueur du commentaire

    return Buffer.concat([...localParts, centralDirectory, end]);
  }
}
