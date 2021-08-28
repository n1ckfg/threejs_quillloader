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
			const zip = fflate.unzipSync(new Uint8Array(buffer));//.slice(16)));
			const metadata = JSON.parse(fflate.strFromU8(zip["Quill.json"]));
			const data = new DataView(zip["Quill.qbin"].buffer);
			
			const material = new THREE.LineBasicMaterial({
				vertexColors: true,
			});

			const scale = 10;

			const children = metadata["Sequence"]["RootLayer"]["Implementation"]["Children"];

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
						offset += 36;
						
						const numVertices = data.getInt32(offset, true);

						const positions = new Float32Array(numVertices * 3);
						const colors = new Float32Array(numVertices * 4);
						const widths = new Float32Array(numVertices);

						offset += 4;

						for (let l = 0, m = 0, n = 0; n < numVertices; l += 3, m += 4, n++) {
							positions[l+0] = data.getFloat32(offset + 0, true) * scale; // x
							positions[l+1] = data.getFloat32(offset + 4, true) * scale; // y
							positions[l+2] = data.getFloat32(offset + 8, true) * scale; // z

							offset += 36;

							colors[m+0] = data.getFloat32(offset + 0, true); // r
							colors[m+1] = data.getFloat32(offset + 4, true); // g
							colors[m+2] = data.getFloat32(offset + 8, true); // b
							colors[m+3] = data.getFloat32(offset + 12, true); // a

							offset += 16;

							widths[n] = data.getFloat32(offset + 0, true);

							offset += 4;
						}
						
						const geometry = new THREE.BufferGeometry();
						geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
						geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 4));
						
						const line = new THREE.Line(geometry, material);
						scene.add(line);
					}
				}
    		}
		}

	}

	THREE.QuillLoader = QuillLoader;

})();
