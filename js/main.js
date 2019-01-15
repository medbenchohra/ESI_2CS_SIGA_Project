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
    check_the_checkbox("layer0");
    check_the_checkbox("layer1");
    check_the_checkbox("layer2");
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
        // attributions: [
        //     new ol.Attribution({
        //         html: '&copy;<a href="https://opensource.org/licenses/MIT/">SIG-A frlm </a>'
        //     })
        // ],
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


    $('#layer0').change(function () {
        console.log("changed!!!");
        showSelectLayer();
    });
    $('#layer1').change(function () {
        showSelectLayer();
    });
    $('#layer2').change(function () {
        showSelectLayer();
    });

    function askForShapeName(feature) {
        const prompt = require('electron-prompt');

        prompt({
            title: 'Naming',
            label: 'Please enter the name of the shape :',
            value: 'City, District or Road',
            inputAttrs: {type: 'url'}
        }).then((r) => {
            if (r === null) {
                console.log('user cancelled');
            } else {
                feature.set('name', r);
            }
        }).catch(console.error);
    }

    function askForShapeStyle(feature) {
        const prompt = require('electron-prompt');

        prompt({
            title: 'Naming',
            label: 'Please enter the name of the shape :',
            value: 'City, District or Road',
            inputAttrs: {type: 'url'},
            height: 200
        }).then((r) => {
            if (r === null) {
                console.log('user cancelled');
            } else {
                feature.set('name', r);
            }
        }).catch(console.error);
    }

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
                        askForShapeName(e.feature);
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
                        askForShapeName(e.feature);
                        transactWFS('insert', e.feature);
                    });
                    break;

                case 'btnArea':
                    interaction = new ol.interaction.Draw({
                        type: 'Polygon',
                        source: layerWFS.getSource()
                    });
                    interaction.on('drawend', function (e) {
                        askForShapeName(e.feature);
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
                    features.forEach((feature) => interaction.getFeatures().push(feature));
                    interaction.getFeatures().on('add', function () {
                        for (var i = 0; i < features.length; i++) transactWFS('delete', features[i]);
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
                case 'btnSymbologie':
                    map.on('click', function (e) {
                        var feat = map.forEachFeatureAtPixel(e.pixel, function (feature, layer) {
                            //if feature is in the layer you want
                            return feature;
                        });
                        if (feat != null) {
                            switch (feat.getGeometry().getType()) {
                                case 'Polygon':
                                    style_polygons();
                                    break;
                                case 'LineString':
                                    style_LineString();
                                    break;
                                case 'Point':
                                    style_Points();
                                    break;
                                default:
                                    break;
                            }
                        }
                    });
                    break;

                case 'btnSelect':
                    break;

                case 'btnExport':
                    print();
                    break;

                default:
            }
        }
    );

    var style_LineString = function () {
        let features = sourceWFS.getFeatures();
        features.forEach((feature) => {
            if (feature.getGeometry().getType() === 'LineString') {
                var hue = 'rgb(' + (Math.floor(Math.random() * 256)) + ',' +
                    (Math.floor(Math.random() * 256)) + ',' + (Math.floor(Math.random() * 256)) + ')';
                var Line_string_style = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        width: 6,
                        color: hue
                    })
                });
                feature.setStyle(Line_string_style);
            }
        });
    };

    var style_Points = function () {
        let features = sourceWFS.getFeatures();
        counter = 0;
        NO_features = features.length;
        for (counter; counter < NO_features; counter++) {
            feature = features[counter];
            if (feature.getGeometry().getType() === 'Point') {
                var hue = 'rgb(' + (Math.floor(Math.random() * 256)) + ',' +
                    (Math.floor(Math.random() * 256)) + ',' + (Math.floor(Math.random() * 256)) + ')';
                var Point_style = new ol.style.Style({
                    image: new ol.style.Circle({
                        radius: 5,
                        fill: null,
                        stroke: new ol.style.Stroke({
                            color: hue,
                            width: 3
                        })
                    })
                });
                feature.setStyle(Point_style);
            }
        }
    };

    var style_polygons = function () {
        let features = sourceWFS.getFeatures();
        counter = 0;
        NO_features = features.length;
        let colors = build_colors_for_polygons([255, 0, 0], [0, 0, 255], NO_features);
        for (counter; counter < NO_features; counter++) {
            feature = features[counter];
            if (feature.getGeometry().getType() === 'Polygon') {
                var Polygon_style = new ol.style.Style({
                    fill: new ol.style.Fill({color: colors[counter]})
                });
                console.log(colors[counter]);
                feature.setStyle(Polygon_style);
            }
        }
    };
    var build_colors_for_polygons = function (start, end, n) {

        //Distance between each color
        var steps = [
            (end[0] - start[0]) / n,
            (end[1] - start[1]) / n,
            (end[2] - start[2]) / n
        ];

        //Build array of colors
        var colors = [start];
        for (var ii = 0; ii < n - 1; ++ii) {
            colors.push([
                Math.floor(colors[ii][0] + steps[0]),
                Math.floor(colors[ii][1] + steps[1]),
                Math.floor(colors[ii][2] + steps[2])
            ]);
        }
        colors.push(end);

        return colors;
    };
    // var build_colors4 = function (start, end, n) {
    //
    //     //Distance between each color
    //     a = (end[0] - start[0]);
    //     if (a < 0) a = -a;
    //     b = (end[1] - start[1]);
    //     if (b < 0) b = -b;
    //     c = (end[2] - start[2]);
    //     if (c < 0) c = -c;
    //     d = (end[3] - start[3]);
    //     if (d < 0) d = -d;
    //     d = 0;
    //     var steps = [a / n, b / n, c / n, d / n];
    //
    //     //Build array of colors
    //     var colors = [start];
    //     for (var ii = 0; ii < n - 1; ++ii) {
    //         colors.push([
    //             Math.floor(colors[ii][0] + steps[0]),
    //             Math.floor(colors[ii][1] + steps[1]),
    //             Math.floor(colors[ii][2] + steps[2]),
    //             Math.floor(colors[ii][3] + steps[3])
    //         ]);
    //     }
    //     colors.push(end);
    //
    //     return colors;
    // };

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
        coordinateFormat: ol.coordinate.createStringXY(0),
        target: $('#coords').get(0),
        projection: 'EPSG:4326'
    });

    var radius = 5000;//the distance of the buffer

    map.addControl(mouse_position);

    map.on('pointermove', function () {
        showSelectLayer();
    });

}

let check_the_checkbox = function (id) {
    document.getElementById(id).checked = true;
};

function showSelectLayer() {
    let features = sourceWFS.getFeatures();
    for (let i = 0; i < features.length; i++) {
        features[i].setStyle(new ol.style.Style({}));
        let valuePoint = document.getElementById("layer0");
        let valueLine = document.getElementById("layer1");
        let valuePolygon = document.getElementById("layer2");
        if ((features[i].getGeometry().getType() === valuePoint.getAttribute("value")) &&
            valuePoint.checked) {
            features[i].setStyle(null);
        }
        if ((features[i].getGeometry().getType() === valueLine.getAttribute("value")) &&
            valueLine.checked) {
            features[i].setStyle(null);
        }
        if ((features[i].getGeometry().getType() == valuePolygon.getAttribute("value")) && valuePolygon.checked) {
            features[i].setStyle(null);
        }
    }

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

function showAttribTable() {
    $(document.getElementById("attribTable")).show()
}

function hideAttribTable() {
    $(document.getElementById("attribTable")).hide()
}

function renderAttribTable(attribTable) {
    $(document).ready(function () {
        var table = '<table class="table table-striped">';
        table += '<tr>';
        var flag = 0;
        $.each(attribTable[0], function (index, value) {
            table += '<th>' + index + '</th>';
        });
        table += '</tr>';
        $.each(attribTable, function (index, value) {
            table += '<tr>';
            $.each(value, function (index2, value2) {
                table += '<td>' + value2 + '</td>';
            });
            table += '<tr>';
        });
        table += '</table>';
        $(document.getElementById("attribTable")).html(table);
    });
}

function addFeatureToAttribTable(attribTable, feature) {

}

function createAttribTableFromFeatures(features) {
    attribTable = [];

    for (i = 0; i < features.length; i++) {
        featureType = features[i].getGeometry().getType();
        switch (featureType) {
            case 'Polygon':
                attribTable[i] = {
                    'id': i,
                    'name': features[i].get('name'),
                    'area': Math.floor(Measurement(features[i])),
                    'distance': '-'
                };
                break;

            case 'LineString':
                attribTable[i] = {
                    'id': i,
                    'name': features[i].get('name'),
                    'area': '-',
                    'distance': Math.floor(Measurement(features[i]))
                };
                break;

            case 'Point':
                attribTable[i] = {
                    'id': i,
                    'name': features[i].get('name'),
                    'area': '-',
                    'distance': '-'
                };
                break;

            default:
                console.log("there is another Goe type ?", feature.getGeometry().getType());
        }
    }

    return attribTable;
}

createMap('./data/Dz_Batna_map.png', 1280, 930);

function getScale() {
    return document.getElementById('inputScale').value;
}


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

