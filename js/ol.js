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
    url: function(extent) {
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
                url: './data/Dz_Batna_map.png',
                imageSize: [1280, 930],
                projection: pixelProjection,
                imageExtent: pixelProjection.getExtent()
            })
        }),
        layerWFS ],

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
    }).done(function() {
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

    $('#btnZoomIn').on('click', function() {
        var view = map.getView();
        var newResolution = view.constrainResolution(view.getResolution(), 1);
        view.setResolution(newResolution);
    });

    $('#btnZoomOut').on('click', function() {
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
unitsSelect.on('change', function() {
    scaleLineControl.setUnits(this.value);
});
unitsSelect.val(scaleLineControl.getUnits());
