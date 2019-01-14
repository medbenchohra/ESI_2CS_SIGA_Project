
var formatWFS = new ol.format.WFS();

var formatGML = new ol.format.GML({
    featureNS: 'https://gsx.geolytix.net/geoserver/geolytix_wfs',
    featureType: 'wfs_geom',
    srsName: 'EPSG:3857'
});

var xs = new XMLSerializer();

var sourceWFS = new ol.source.Vector({
    loader: function (extent) {
        $.ajax('https://gsx.geolytix.net/geoserver/geolytix_wfs/ows', {
            type: 'GET',
            data: {
                service: 'WFS',
                version: '1.1.0',
                request: 'GetFeature',
                typename: 'wfs_geom',
                srsname: 'EPSG:3857',
                bbox: extent.join(',') + ',EPSG:3857'
            }
        }).done(function (response) {
            sourceWFS.addFeatures(formatWFS.readFeatures(response));
            // sourceWFS.clear();
        });
    },
    //strategy: ol.loadingstrategy.tile(ol.tilegrid.createXYZ()),
    strategy: ol.loadingstrategy.bbox,
    projection: 'EPSG:3857'
});
sourceWFS.clear();
var layerWFS = new ol.layer.Vector({
    source: sourceWFS
});


function createMap(link, w, h) {
    var interaction;

    var interactionSelectPointerMove = new ol.interaction.Select({
        condition: ol.events.condition.pointerMove
    });

    var interactionSelect = new ol.interaction.Select({
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#FF2828'
            })
        })
    });

    var interactionSnap = new ol.interaction.Snap({
        source: layerWFS.getSource()
    });

    var scaleLineControl = new ol.control.ScaleLine();
    var pixelProjection = new ol.proj.Projection({
        code: 'pixel',
        units: 'pixels',
        extent: [0, 0, w, h]
    });
	
    var mysource = new ol.source.ImageStatic({
        attributions: [
            new ol.Attribution({
                html: '&copy;<a href="https://opensource.org/licenses/MIT/">SIG-A frlm </a>'
            })
        ],
        url: link,
        imageSize: [w, h],
        projection: pixelProjection,
        imageExtent: pixelProjection.getExtent()
    });
	
    var mylayer = new ol.layer.Image({
        source: mysource
    });

    var map = new ol.Map({
        controls: ol.control.defaults({
            attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
                collapsible: false
            })
        }).extend([
            scaleLineControl
        ]),
        layers: [
            mylayer,
            layerWFS],

        target: 'map',
        view: new ol.View({
            projection: pixelProjection,
            center: ol.extent.getCenter(pixelProjection.getExtent()),
            zoom: 2
        })
    });

//wfs-t
    var util = {};
    var transactWFS = function (mode, f) {
        var node;
        switch (mode) {
            case 'insert':
                node = formatWFS.writeTransaction([f], null, null, formatGML);
                break;
            case 'update':
                node = formatWFS.writeTransaction(null, [f], null, formatGML);
                break;
            case 'delete':
                node = formatWFS.writeTransaction(null, null, [f], formatGML);
                break;
        }
        var payload = xs.serializeToString(node);
        $.ajax('https://gsx.geolytix.net/geoserver/geolytix_wfs/ows', {
            type: 'POST',
            dataType: 'xml',
            processData: false,
            contentType: 'text/xml',
            data: payload
        }).done(function () {
            sourceWFS.clear();
        });
    };
    $('button').click(function () {
            $(this).siblings().removeClass('btn-active');
            $(this).addClass('btn-active');
            map.removeInteraction(interaction);
            interactionSelect.getFeatures().clear();
            map.removeInteraction(interactionSelect);

            switch ($(this).attr('id')) {

                case 'btnEdit':
                    map.addInteraction(interactionSelect);
                    interaction = new ol.interaction.Modify({
                        features: interactionSelect.getFeatures()
                    });
                    map.addInteraction(interaction);
                    map.addInteraction(interactionSnap);
                    util = {};
                    interactionSelect.getFeatures().on('add', function (e) {
                        e.element.on('change', function (e) {
                            util[e.target.getId()] = true;
                        });
                    });
                    interactionSelect.getFeatures().on('remove', function (e) {
                        var f = e.element;
                        if (util[f.getId()]) {
                            delete util[f.getId()];
                            var featureProperties = f.getProperties();
                            delete featureProperties.boundedBy;
                            var clone = new ol.Feature(featureProperties);
                            clone.setId(f.getId());
                            transactWFS('update', clone);
                        }
                    });
                    break;
                case 'btnPoint':
                    interaction = new ol.interaction.Draw({
                        type: 'Point',
                        source: layerWFS.getSource()
                    });
                    map.addInteraction(interaction);
                    interaction.on('drawend', function (e) {
                        transactWFS('insert', e.feature);
                    });
                    break;

                case 'btnLine':
                    interaction = new ol.interaction.Draw({
                        type: 'LineString',
                        source: layerWFS.getSource()
                    });
                    map.addInteraction(interaction);
                    interaction.on('drawend', function (e) {
                        transactWFS('insert', e.feature);
                    });
                    break;

                case 'btnArea':
                    interaction = new ol.interaction.Draw({
                        type: 'Polygon',
                        source: layerWFS.getSource()
                    });
                    interaction.on('drawend', function (e) {
                        transactWFS('insert', e.feature);
                    });
                    map.addInteraction(interaction);
                    break;

                case 'btnDelete':
                    interaction = new ol.interaction.Select();
                    interaction.getFeatures().on('add', function (e) {
                        transactWFS('delete', e.target.item(0));
                        interactionSelectPointerMove.getFeatures().clear();
                        interaction.getFeatures().clear();
                    });
                    map.addInteraction(interaction);
                    break;
					
                case 'btnDeleteAll':
                    interaction = new ol.interaction.Select();
                    var features = layerWFS.getSource().getFeatures();
                    features.forEach((feature)=> interaction.getFeatures().push(feature));
                    interaction.getFeatures().on('add', function () {
                        for (var i=0; i<features.length; i++) transactWFS('delete', features[i]);
                        interactionSelectPointerMove.getFeatures().clear();
                        interaction.getFeatures().clear();
                        sourceWFS.clear();
                    });
                    map.addInteraction(interaction);
                    break;
					
                case 'btnOperations':
                    counter = 0;
                    var selected = [];
                    map.on('click', function (e) {
                            var feat = map.forEachFeatureAtPixel(e.pixel, function (feature, layer) {
                                //if feature is in the layer you want
                                return feature;
                            });
                            if (feat != null) {
                                selected.push(feat);
                                if (feat.getGeometry().getType() === 'Polygon' && selected.length === 2) {
                                    var geomA = selected[0].getGeometry();
                                    var geomB = selected[1].getGeometry();
                                    intersection = polyIntersectsPoly(geomA, geomB);
                                    if (intersection === true) {
                                        alert("There is intersection");
                                    } else {
                                        alert("There is no intersection");
                                    }
                                    selected = [];
                                }
                            }
                        }
                    );
                    break;
					
                case 'btnSelect':
                    break;
					
                default:
                    break;
            }
        }
    );

    function createJstsPolygon(geometryFactory, polygon) {
        var path = polygon.getPath();
        var coordinates = path.getArray().map(function name(coord) {
            return new jsts.geom.Coordinate(coord.lat(), coord.lng());
        });
        if (coordinates[0].compareTo(coordinates[coordinates.length - 1]) != 0)
            coordinates.push(coordinates[0]);
        var shell = geometryFactory.createLinearRing(coordinates);
        return geometryFactory.createPolygon(shell);
    }

    function polyIntersectsPoly(polygeomA, polygeomB) {
        var jsts = require('jsts');
        var geomA = new jsts.io.GeoJSONReader().read(new ol.format.GeoJSON().writeFeatureObject(
            new ol.Feature({
                geometry: polygeomA
            })
            )
        ).geometry;
        var geomB = new jsts.io.GeoJSONReader().read(new ol.format.GeoJSON().writeFeatureObject(
            new ol.Feature({
                geometry: polygeomB
            })
            )
        ).geometry;
        return geomA.intersects(geomB);
    };

	//Display the coordinates :
    var mouse_position = new ol.control.MousePosition({
        coordinateFormat: ol.coordinate.createStringXY(4),
        projection: 'EPSG:4326'
    });
    var radius = 5000;//the distance of the buffer
   
    map.addControl(mouse_position);
	
}

function Measurement(feature) {
	if (feature != null) {
		switch (feature.getGeometry().getType()) {
			case'Polygon':
				return feature.getGeometry().getArea();
				break;
			case   'LineString':
				return feature.getGeometry().getLength();
				break;
			default:
				return null;
		}
	}
}

function createAttribTable(features) {
	attribTable = {};
	
	for(i=0 ; i++ ; features.length) {
		featureType = feature.getGeometry().getType();
		switch (featureType) {
			case 'Polygon':
				attribTable[""+i] = {
					'name': features[i].get('name'),
					'area': Measurement(features[i])
				};
				break;
				
			case 'LineString':
				attribTable[""+i] = {
					'name': features[i].get('name'),
					'distance': Measurement(features[i])
				};
				break;
				
			case 'Point':
				attribTable[""+i] = {
					'name': features[i].get('name')
				};
				break;
				
			default:
				console.log("there is another Goe type ?", feature.getGeometry().getType());
		}
	}
	
	return attribTable;
}
 
createMap('./data/Dz_Batna_map.png', 1280, 930);

//----------------------------------------------------------//

var $$ = document.querySelector.bind(document);

//APP
var App = {};
App.init = function () {
    //Init
    function handleFileSelect(evt) {
        var files = evt.target.files; // FileList object

        //files template
        var template = "" + Object.keys(files).map(function (file) {
            return "<div class=\"file file--" + file + "\">\n     <div class=\"name\"><span>" +
                files[file].name + "</span></div>\n     <div class=\"progress active\"></div>\n     <div class=\"done\">\n\t<a href=\"\" target=\"_blank\">\n      <svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" version=\"1.1\" x=\"0px\" y=\"0px\" viewBox=\"0 0 1000 1000\">\n\t\t<g><path id=\"path\" d=\"M500,10C229.4,10,10,229.4,10,500c0,270.6,219.4,490,490,490c270.6,0,490-219.4,490-490C990,229.4,770.6,10,500,10z M500,967.7C241.7,967.7,32.3,758.3,32.3,500C32.3,241.7,241.7,32.3,500,32.3c258.3,0,467.7,209.4,467.7,467.7C967.7,758.3,758.3,967.7,500,967.7z M748.4,325L448,623.1L301.6,477.9c-4.4-4.3-11.4-4.3-15.8,0c-4.4,4.3-4.4,11.3,0,15.6l151.2,150c0.5,1.3,1.4,2.6,2.5,3.7c4.4,4.3,11.4,4.3,15.8,0l308.9-306.5c4.4-4.3,4.4-11.3,0-15.6C759.8,320.7,752.7,320.7,748.4,325z\"</g>\n\t\t</svg>\n\t\t\t\t\t\t</a>\n     </div>\n    </div>";
        }).join("");

        $$("#drop").classList.add("hidden");
        $$("footer").classList.add("hasFiles");
        $$(".importar").classList.add("active");
        setTimeout(function () {
            $$(".list-files").innerHTML = template;
        }, 1000);

        Object.keys(files).forEach(function (file) {
            var load = 2000 + file * 2000; // fake load
            setTimeout(function () {
                $$(".file--" + file).querySelector(".progress").classList.remove("active");
                $$(".file--" + file).querySelector(".done").classList.add("anim");
            }, load);
        });
        // document.getElementById("map-wrapper").classList.add("hidden");
        img = files[0];
        // var sizeOf = require('image-size');
        // sizeOf(img.path, function (err, dimensions) {
        //     try {
        //         createMap(img.path, dimensions.width, dimensions.height);
        //         console.log("creating the map");
        //         console.log(dimensions.height, dimensions.width);
        //     } catch (ex) {
        //         console.log("image dimensions !!");
        //     }
        // });
        //console.log(img);
        //or however you get a handle to the IMG

    }

    // trigger input
    $$("#triggerFile").addEventListener("click", function (evt) {
        evt.preventDefault();
        $$("input[type=file]").click();
    });

    // drop events
    $$("#drop").ondragleave = function (evt) {
        $$("#drop").classList.remove("active");
        evt.preventDefault();
    };
    $$("#drop").ondragover = $$("#drop").ondragenter = function (evt) {
        $$("#drop").classList.add("active");
        evt.preventDefault();
    };
    $$("#drop").ondrop = function (evt) {
        $$("input[type=file]").files = evt.dataTransfer.files;
        $$("footer").classList.add("hasFiles");
        $$("#drop").classList.remove("active");
        evt.preventDefault();
    };

    //upload more
    $$(".importar").addEventListener("click", function () {
        $$(".list-files").innerHTML = "";
        $$("footer").classList.remove("hasFiles");
        $$(".importar").classList.remove("active");
        setTimeout(function () {
            $$("#drop").classList.remove("hidden");
        }, 500);

        document.getElementById("upload-img").classList.add("hidden");
        document.getElementById("map-wrapper").classList.remove("hidden");
        var sizeOf = require('image-size');
        sizeOf(img.path, function (err, dimensions) {
            try {
                // createMap(img.path, dimensions.width, dimensions.height);
                createMap('./data/Dz_Batna_map.png', 1280, 930);
                console.log(dimensions.height, dimensions.width);
            } catch (ex) {
                console.log("image dimensions !!");
            }
        });

    });

    // input change
    $$("input[type=file]").addEventListener("change", handleFileSelect);
}();
