function createMap(link, w, h) {
    var projection = new ol.proj.Projection({
        code: 'EPSG:3857',
        units: 'm',
        axisOrientation: 'neu'
    });

    var formatWFS = new ol.format.WFS();

    var formatGML = new ol.format.GML({
        featureNS: 'http://geocatalogue.databenc.it/geoserver/chis_test',
        featureType: 'wfs_geom',
        srsName: 'EPSG:3857'
    });

    var xs = new XMLSerializer();

    var sourceWFS = new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: function (extent) {
            return 'http://geocatalogue.databenc.it/geoserver/chis_test/ows?service=WFS&' +
                'version=1.1.0&request=GetFeature&typename=chis_test:wfs_geom&' +
                'outputFormat=application/json&srsname=EPSG:3857&' +
                'bbox=' + extent.join(',') + ',EPSG:3857';
        },
        strategy: ol.loadingstrategy.bbox,
        projection: projection
    });

    var layerWFS = new ol.layer.Vector({
        source: sourceWFS
    });
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
//the scaleline
    var scaleLineControl = new ol.control.ScaleLine();

// the projection
    var pixelProjection = new ol.proj.Projection({
        code: 'pixel',
        units: 'pixels',
        extent: [0, 0, 1280, 930]
    });
//the map : 2 layers , Batna map and layerWFS
    var map = new ol.Map({
        controls: ol.control.defaults({
            attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
                collapsible: false
            })
        }).extend([
            scaleLineControl
        ]),
        layers: [
            new ol.layer.Image({
                source: new ol.source.ImageStatic({
                    attributions: [
                        new ol.Attribution({
                            html: '&copy;<a href="https://opensource.org/licenses/MIT/">SIG-A frlm </a>'
                        })
                    ],
                    url: link,
                    imageSize: [w, h],
                    projection: pixelProjection,
                    imageExtent: pixelProjection.getExtent()
                })
            }),
            layerWFS],

        target: 'map',
        view: new ol.View({
            projection: pixelProjection,
            center: ol.extent.getCenter(pixelProjection.getExtent()),
            zoom: 2
        })
    });

//---------------------------------------

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
        $.ajax('http://geocatalogue.databenc.it/geoserver/chis_test/ows', {
            type: 'POST',
            dataType: 'xml',
            processData: false,
            contentType: 'text/xml',
            data: payload
        }).done(function () {
            sourceWFS.clear();
        });
    };

// Buttons : OnClick Actions

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

            default:
                break;
        }
    });

//onClick actions :

    $('#btnZoomIn').on('click', function () {
        var view = map.getView();
        var newResolution = view.constrainResolution(view.getResolution(), 1);
        view.setResolution(newResolution);
    });

    $('#btnZoomOut').on('click', function () {
        var view = map.getView();
        var newResolution = view.constrainResolution(view.getResolution(), -1);
        view.setResolution(newResolution);
    });
//Display the coordinates :
    var mouse_position = new ol.control.MousePosition({
        coordinateFormat: ol.coordinate.createStringXY(4),
        projection: 'EPSG:4326'
    });
    map.addControl(mouse_position);
//Display the scale :
    var unitsSelect = $('#units');
    unitsSelect.on('change', function () {
        scaleLineControl.setUnits(this.value);
    });
    unitsSelect.val(scaleLineControl.getUnits());
}
createMap('./data/Dz_Batna_map.png',1280,930);
//----------------------------------------------------------//

var $$ = document.querySelector.bind(document);
// document.getElementById("btnPoint").classList.add("hidden");
//APP
var App = {};
let h="global" ;
let w="global";

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
            var load = 1000 + file * 1000; // fake load
            setTimeout(function () {
                $$(".file--" + file).querySelector(".progress").classList.remove("active");
                $$(".file--" + file).querySelector(".done").classList.add("anim");
            }, load);
        });
        var img = files[0];
        var sizeOf = require('image-size');
        sizeOf(img.path, function (err, dimensions) {
            try {
                if (!err) {
                    h = dimensions.height;
                    w = dimensions.width;
                    createMap(img.path, w, h);
                }
            } catch (ex) {
                console.log("image dimensions !!! ");
            }
        });
        // console.log(w,h);
        // createMap(img.path, w, h);
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
        // createMap('./data/Dz_Batna_map.png');
        document.getElementById("upload-img").classList.add("hidden");
        // document.getElementById("map-wrapper").classList.remove("hidden");
        $$(".list-files").innerHTML = "";
        $$("footer").classList.remove("hasFiles");
        $$(".importar").classList.remove("active");
        setTimeout(function () {
            $$("#drop").classList.remove("hidden");
        }, 500);
    });

    // input change
    $$("input[type=file]").addEventListener("change", handleFileSelect);
};



