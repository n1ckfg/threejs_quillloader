"use strict";

(function () {

	class QuillLoader extends THREE.Loader {

		load(url, onLoad, onProgress, onError) {
			const scope = this;
			const loader = new THREE.FileLoader(this.manager);
			loader.setPath(this.path);
			loader.setResponseType("arraybuffer");
			loader.setWithCredentials(this.withCredentials);
			loader.load(url, function (buffer) {
				try {

					onLoad(scope.parse(buffer));

				} catch (e) {
					if (onError) {
						onError(e);
					} else {
						console.error(e);
					}

					scope.manager.itemError(url);
				}
			}, onProgress, onError);
		}

		parse(buffer) {
			const group = new THREE.Group(); // https://docs.google.com/document/d/11ZsHozYn9FnWG7y3s3WAyKIACfbfwb4PbaS8cZ_xjvo/edit#
			const zip = fflate.unzipSync(new Uint8Array(buffer));//.slice(16)));
			const metadata = JSON.parse(fflate.strFromU8(zip["Quill.json"]));
			const data = new DataView(zip["Quill.qbin"].buffer);
			
			const children = metadata["Sequence"]["RootLayer"]["Implementation"]["Children"];
			const strokes = [];
			const scale = 10;

    		for (let i=0; i < children.length; i++) {
      			const childNode = children[i];

				// skip the child node if it contains no drawings
				let drawingCount = 0;
				try {
					drawingCount = childNode["Implementation"]["Drawings"].length;
				} catch (e) { 
					continue;
				}

				for (let j=0; j < drawingCount; j++) {
					const drawingNode  = childNode["Implementation"]["Drawings"][j];

					const dataFileOffsetString = drawingNode["DataFileOffset"];

					const dataFileOffset = parseInt("0x" + dataFileOffsetString);

					const numNodeStrokes = data.getInt32(dataFileOffset, true);

					let offset = dataFileOffset + 4;

					for (let k = 0; k < numNodeStrokes; k++) {
					let positions = [];
					let colors = [];
					let widths = [];

					offset += 36;

					const numVertices = data.getInt32(offset, true);

					offset += 4;

					for (let l = 0; l < numVertices; l++) {
						const x = data.getFloat32(offset + 0, true);
						const y = data.getFloat32(offset + 4, true);
						const z = data.getFloat32(offset + 8, true);
						positions.push(new THREE.Vector3(x, y, z) * scale);

						offset += 36;

						const r = data.getFloat32(offset + 0, true) * 255;
						const g = data.getFloat32(offset + 4, true) * 255;
						const b = data.getFloat32(offset + 8, true) * 255;
						const a = data.getFloat32(offset + 12, true) * 255;
						colors.push(new THREE.Color(r, g, b, a));

						offset += 16;

						widths.push(data.getFloat32(offset + 0, true));

						offset += 4;
					}

					//strokes.add(new QuillStroke(parent, positions, widths, colors));
					}
				}
    		}

			/*
			const num_strokes = data.getInt32(16, true);
			const brushes = {};
			let offset = 20;

			for (let i = 0; i < num_strokes; i ++) {
				const brush_index = data.getInt32(offset, true);
				const brush_color = [data.getFloat32(offset + 4, true), data.getFloat32(offset + 8, true), data.getFloat32(offset + 12, true), data.getFloat32(offset + 16, true)];
				const brush_size = data.getFloat32(offset + 20, true);
				const stroke_mask = data.getUint32(offset + 24, true);
				const controlpoint_mask = data.getUint32(offset + 28, true);
				let offset_stroke_mask = 0;
				let offset_controlpoint_mask = 0;

				for (let j = 0; j < 4; j ++) {
					// TOFIX: I don't understand these masks yet
					const byte = 1 << j;
					if ((stroke_mask & byte) > 0) offset_stroke_mask += 4;
					if ((controlpoint_mask & byte) > 0) offset_controlpoint_mask += 4;

				} // console.log({ brush_index, brush_color, brush_size, stroke_mask, controlpoint_mask });
				// console.log(offset_stroke_mask, offset_controlpoint_mask);

				offset = offset + 28 + offset_stroke_mask + 4; // TOFIX: This is wrong

				const num_control_points = data.getInt32(offset, true); // console.log({ num_control_points });

				const positions = new Float32Array(num_control_points * 3);
				const quaternions = new Float32Array(num_control_points * 4);
				offset = offset + 4;

				for (let j = 0, k = 0; j < positions.length; j += 3, k += 4) {
					positions[j + 0] = data.getFloat32(offset + 0, true);
					positions[j + 1] = data.getFloat32(offset + 4, true);
					positions[j + 2] = data.getFloat32(offset + 8, true);
					quaternions[k + 0] = data.getFloat32(offset + 12, true);
					quaternions[k + 1] = data.getFloat32(offset + 16, true);
					quaternions[k + 2] = data.getFloat32(offset + 20, true);
					quaternions[k + 3] = data.getFloat32(offset + 24, true);
					offset = offset + 28 + offset_controlpoint_mask; // TOFIX: This is wrong
				}

				if (brush_index in brushes === false) {
					brushes[brush_index] = [];
				}

				brushes[brush_index].push([positions, quaternions, brush_size, brush_color]);
			}

			for (const brush_index in brushes) {
				const geometry = new StrokeGeometry(brushes[brush_index]);
				const material = getMaterial(metadata.BrushIndex[brush_index]);
				group.add(new THREE.Mesh(geometry, material));
			}

			return group;
		*/
		}
	}

	class StrokeGeometry extends THREE.BufferGeometry {

		constructor(strokes) {
			super();
			const vertices = [];
			const colors = [];
			const uvs = [];
			const position = new THREE.Vector3();
			const prevPosition = new THREE.Vector3();
			const quaternion = new THREE.Quaternion();
			const prevQuaternion = new THREE.Quaternion();
			const vector1 = new THREE.Vector3();
			const vector2 = new THREE.Vector3();
			const vector3 = new THREE.Vector3();
			const vector4 = new THREE.Vector3(); // size = size / 2;

			for (const k in strokes) {
				const stroke = strokes[k];
				const positions = stroke[0];
				const quaternions = stroke[1];
				const size = stroke[2];
				const color = stroke[3];
				prevPosition.fromArray(positions, 0);
				prevQuaternion.fromArray(quaternions, 0);

				for (let i = 3, j = 4, l = positions.length; i < l; i += 3, j += 4) {
					position.fromArray(positions, i);
					quaternion.fromArray(quaternions, j);
					vector1.set(- size, 0, 0);
					vector1.applyQuaternion(quaternion);
					vector1.add(position);
					vector2.set(size, 0, 0);
					vector2.applyQuaternion(quaternion);
					vector2.add(position);
					vector3.set(size, 0, 0);
					vector3.applyQuaternion(prevQuaternion);
					vector3.add(prevPosition);
					vector4.set(- size, 0, 0);
					vector4.applyQuaternion(prevQuaternion);
					vector4.add(prevPosition);
					vertices.push(vector1.x, vector1.y, - vector1.z);
					vertices.push(vector2.x, vector2.y, - vector2.z);
					vertices.push(vector4.x, vector4.y, - vector4.z);
					vertices.push(vector2.x, vector2.y, - vector2.z);
					vertices.push(vector3.x, vector3.y, - vector3.z);
					vertices.push(vector4.x, vector4.y, - vector4.z);
					prevPosition.copy(position);
					prevQuaternion.copy(quaternion);
					colors.push(...color);
					colors.push(...color);
					colors.push(...color);
					colors.push(...color);
					colors.push(...color);
					colors.push(...color);
					const p1 = i / l;
					const p2 = (i - 3) / l;
					uvs.push(p1, 0);
					uvs.push(p1, 1);
					uvs.push(p2, 0);
					uvs.push(p1, 1);
					uvs.push(p2, 1);
					uvs.push(p2, 0);
				}
			}

			this.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
			this.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 4));
			this.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
		}

	}

	function getMaterial() {
		return new THREE.MeshBasicMaterial({
			vertexColors: true,
			side: THREE.DoubleSide
		});
	}

	THREE.QuillLoader = QuillLoader;

})();
