import * as THREE from "three";
import type { ProductId } from "../types";

/** Geometrias compartilhadas — low-poly de propósito. */
export type SharedGeo = {
  box: THREE.BoxGeometry;
  sphere: THREE.SphereGeometry;
  cyl: THREE.CylinderGeometry;
  cone: THREE.ConeGeometry;
  plane: THREE.PlaneGeometry;
};

export function makeSharedGeo(lowFx: boolean): SharedGeo {
  const s = lowFx ? 6 : 8;
  return {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(0.5, s, s),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, s),
    cone: new THREE.ConeGeometry(0.5, 1, s),
    plane: new THREE.PlaneGeometry(1, 1),
  };
}

function mat(hex: number, extra?: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: hex, ...extra });
}

function add(
  root: THREE.Group,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = false;
  m.receiveShadow = false;
  root.add(m);
  return m;
}

/** Produto baixo-poli, silhueta distinta (sósias não dependem só da cor). */
export function makeProduct(id: ProductId, geo: SharedGeo): THREE.Group {
  const g = new THREE.Group();
  g.name = id;

  switch (id) {
    case "refri": {
      add(g, geo.cyl, mat(0x2f8f4a), 0, 0.02, 0, 0.42, 0.9, 0.42);
      add(g, geo.cyl, mat(0xe3b23c), 0, 0.5, 0, 0.22, 0.16, 0.22);
      add(g, geo.sphere, mat(0x1f5a32), 0.22, 0.38, 0, 0.22, 0.12, 0.18);
      add(g, geo.cone, mat(0xe3b23c), 0, 0.08, 0.22, 0.16, 0.22, 0.16);
      break;
    }
    case "refriZero": {
      add(g, geo.cyl, mat(0x1a3324), 0, 0.02, 0, 0.4, 0.92, 0.4);
      add(g, geo.box, mat(0xd0d0d0), 0, 0.08, 0.18, 0.44, 0.12, 0.08);
      add(g, geo.cyl, mat(0xc8c8c8), 0, 0.52, 0, 0.2, 0.14, 0.2);
      add(g, geo.box, mat(0xf6f3ea), 0, 0.18, 0.2, 0.14, 0.2, 0.06);
      break;
    }
    case "suco": {
      add(g, geo.box, mat(0xe07a2a), 0, 0.02, 0, 0.48, 0.78, 0.32);
      add(g, geo.box, mat(0xf6e27a), 0, 0.42, 0, 0.5, 0.16, 0.34);
      add(g, geo.sphere, mat(0xc4491d), 0, 0.08, 0.18, 0.28, 0.28, 0.16);
      break;
    }
    case "leite": {
      add(g, geo.box, mat(0xf6f3ea), 0, 0.04, 0, 0.42, 0.88, 0.3);
      add(g, geo.box, mat(0x3b6fb6), 0, 0.48, 0, 0.44, 0.14, 0.32);
      add(g, geo.box, mat(0x3b6fb6), 0, -0.18, 0.16, 0.4, 0.1, 0.04);
      break;
    }
    case "cremeLeite": {
      add(g, geo.box, mat(0xe8d4a8), 0, -0.02, 0, 0.52, 0.55, 0.34);
      add(g, geo.box, mat(0xc68642), 0, 0.32, 0, 0.54, 0.16, 0.36);
      const dia = add(g, geo.box, mat(0xe3b23c), 0, 0.04, 0.18, 0.22, 0.22, 0.06);
      dia.rotation.z = Math.PI / 4;
      break;
    }
    case "agua": {
      add(g, geo.cyl, mat(0x9fd4ee), 0, 0.02, 0, 0.38, 0.88, 0.38);
      add(g, geo.cyl, mat(0x2f6b9a), 0, 0.5, 0, 0.2, 0.14, 0.2);
      add(g, geo.cone, mat(0x2f6b9a), 0, 0.06, 0.2, 0.16, 0.28, 0.16);
      break;
    }
    case "aguaGas": {
      add(g, geo.cyl, mat(0x2a6f9a), 0, 0.02, 0, 0.4, 0.88, 0.4);
      add(g, geo.cyl, mat(0xe3b23c), 0, 0.5, 0, 0.2, 0.14, 0.2);
      add(g, geo.sphere, mat(0x9fd4ee), -0.12, 0.1, 0.18, 0.12, 0.12, 0.12);
      add(g, geo.sphere, mat(0x9fd4ee), 0.1, -0.06, 0.2, 0.1, 0.1, 0.1);
      break;
    }
    case "pao": {
      add(g, geo.sphere, mat(0xc68642), 0, -0.06, 0, 0.7, 0.32, 0.4);
      add(g, geo.sphere, mat(0xe8c49a), 0, 0.04, 0, 0.62, 0.22, 0.34);
      break;
    }
    case "biscoito": {
      add(g, geo.cyl, mat(0xd4a05a), -0.16, -0.12, 0.06, 0.36, 0.1, 0.36);
      add(g, geo.cyl, mat(0xc4491d), -0.16, -0.06, 0.06, 0.16, 0.06, 0.16);
      add(g, geo.cyl, mat(0xd4a05a), 0.16, -0.1, -0.04, 0.34, 0.1, 0.34);
      add(g, geo.cyl, mat(0xd4a05a), 0, 0.08, 0, 0.4, 0.1, 0.4);
      add(g, geo.cyl, mat(0xc4491d), 0, 0.14, 0, 0.18, 0.06, 0.18);
      break;
    }
    case "salgadinho": {
      add(g, geo.box, mat(0xe3b23c), 0, 0, 0, 0.58, 0.82, 0.22);
      add(g, geo.box, mat(0xc4491d), 0, 0.38, 0, 0.6, 0.16, 0.24);
      add(g, geo.sphere, mat(0xf6e27a), -0.12, 0.02, 0.14, 0.14, 0.08, 0.1);
      add(g, geo.sphere, mat(0xf6e27a), 0.1, -0.08, 0.14, 0.12, 0.08, 0.1);
      break;
    }
    case "chocolate": {
      add(g, geo.box, mat(0x5a2a18), 0, 0, 0, 0.72, 0.28, 0.42);
      add(g, geo.box, mat(0x3a1810), -0.12, 0.02, 0, 0.04, 0.3, 0.44);
      add(g, geo.box, mat(0x3a1810), 0.12, 0.02, 0, 0.04, 0.3, 0.44);
      add(g, geo.box, mat(0xe3b23c), 0, 0.16, 0.12, 0.28, 0.08, 0.18);
      break;
    }
    case "ovos": {
      add(g, geo.box, mat(0x3d8f4a), 0, -0.08, 0, 0.72, 0.28, 0.48);
      add(g, geo.sphere, mat(0xf0e6c8), -0.16, 0.1, 0.06, 0.22, 0.28, 0.2);
      add(g, geo.sphere, mat(0xf0e6c8), 0.16, 0.1, 0.06, 0.22, 0.28, 0.2);
      add(g, geo.sphere, mat(0xf0e6c8), 0, 0.12, -0.1, 0.22, 0.28, 0.2);
      break;
    }
    case "macarrao": {
      add(g, geo.box, mat(0xf0c44c), 0, 0, 0, 0.58, 0.86, 0.24);
      add(g, geo.cyl, mat(0xc4491d), 0, 0.06, 0.14, 0.5, 0.06, 0.5);
      add(g, geo.cyl, mat(0xc4491d), 0, -0.1, 0.14, 0.48, 0.05, 0.48);
      break;
    }
    case "arroz": {
      add(g, geo.box, mat(0xf6f3ea), 0, 0, 0, 0.56, 0.84, 0.4);
      add(g, geo.box, mat(0x2f6b4f), 0, 0.06, 0.18, 0.4, 0.28, 0.08);
      break;
    }
    case "feijao": {
      add(g, geo.box, mat(0x6b341f), 0, 0, 0, 0.56, 0.84, 0.4);
      add(g, geo.sphere, mat(0xc9a06a), -0.12, 0.08, 0.18, 0.12, 0.08, 0.1);
      add(g, geo.sphere, mat(0xc9a06a), 0.1, -0.04, 0.2, 0.12, 0.08, 0.1);
      add(g, geo.sphere, mat(0xc9a06a), 0, 0.16, 0.16, 0.1, 0.08, 0.1);
      break;
    }
    case "cafe": {
      add(g, geo.box, mat(0x5a1810), 0, 0, 0, 0.56, 0.82, 0.28);
      add(g, geo.sphere, mat(0xe3b23c), 0, 0.08, 0.16, 0.32, 0.32, 0.16);
      add(g, geo.sphere, mat(0x5a1810), 0, 0.08, 0.22, 0.16, 0.16, 0.1);
      break;
    }
    case "detergente": {
      add(g, geo.cyl, mat(0x3b6fb6), 0, 0.02, 0, 0.4, 0.9, 0.4);
      add(g, geo.box, mat(0xf6f3ea), 0, 0.5, 0, 0.22, 0.16, 0.22);
      add(g, geo.cone, mat(0xf6e27a), 0, 0.06, 0.2, 0.28, 0.28, 0.16);
      break;
    }
    case "amaciante": {
      add(g, geo.cyl, mat(0xe07a8d), 0, 0.02, 0, 0.4, 0.9, 0.4);
      add(g, geo.box, mat(0xf6f3ea), 0, 0.5, 0, 0.22, 0.16, 0.22);
      add(g, geo.sphere, mat(0xffffff), 0, 0.1, 0.22, 0.16, 0.16, 0.12);
      add(g, geo.sphere, mat(0xffffff), -0.12, 0.02, 0.2, 0.14, 0.14, 0.1);
      add(g, geo.sphere, mat(0xffffff), 0.12, 0.02, 0.2, 0.14, 0.14, 0.1);
      add(g, geo.sphere, mat(0xf6e27a), 0, 0.08, 0.28, 0.1, 0.1, 0.08);
      break;
    }
  }

  return g;
}
