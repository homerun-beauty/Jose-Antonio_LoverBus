import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from '@apollo/react-hooks'
import mapboxgl from "mapbox-gl";
import * as MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import { Button } from 'antd';
import "./site.css"
import env from "react-dotenv";

import {
// for query
MARKER_QUERY,
// for mutation
// ADD_MARKER_MUTATION,
// DELETE_MARKER_MUTATION,
// UPDATE_MARKER_MUTATION,
// for subscription
MARKERS_SUBSCRIPTION
} from '../graphql'

mapboxgl.accessToken = process.env.REACT_APP_ACCESS_TOKEM
console.log(mapboxgl.accessToken)
const MapBox = ({username, markerCallback, insertionMode, setInsertionMode, title, setTitle, description, setDescription}) => {
    
    const [View, setView] = useState({
        lng: 121.55,
        lat: 25.05,
        zoom: 12
    })
    const { subscribeMarker, ...markers } = useQuery(
        MARKER_QUERY,
        { variables: { username: username } }
        )
    // const [insertionMode, setInsertionMode] = useState(false)


    const [map, setMap] = useState(null);
    const mapContainer = useRef(null);
    const {data, subscribeToMore} = useQuery(MARKER_QUERY, {variables:{username: username}})

    const [currentMarker, _setCurrentMarker] = useState(null);
    const setCurrentMarker = e => {_setCurrentMarker(e); markerCallback(e);} 
    const [test, setTest] = useState(0);
    const [markerLoaded, setMarkerLoaded] = useState(false);

    useEffect(() => {
        const initializeMap = ({ setMap, mapContainer}) => {
            const map = new mapboxgl.Map({
                container: mapContainer.current,
                style: "mapbox://styles/mapbox/streets-v11", // stylesheet location
                center: [View.lng, View.lat],
                zoom: View.zoom
                });

            map.on("move", () => {
                setView({lng: map.getCenter().lng.toFixed(4), lat: map.getCenter().lat.toFixed(4), zoom:map.getZoom().toFixed(2)})
                setTest(4)
            });

            map.on("load", () => {
                setMap(map);
                map.resize();
            });

            var geocoder = new MapboxGeocoder({
                accessToken: mapboxgl.accessToken,
                mapboxgl: mapboxgl
            })
            map.geocoder = geocoder
            map.addControl(geocoder)
            // map.addControl(
            //     new MapboxGeocoder({
            //     accessToken: mapboxgl.accessToken,
            //     mapboxgl: mapboxgl
            //     })
            // );  

        }
        if (!map) initializeMap({ setMap, mapContainer});
    }, [map]);

    useEffect(()=>{
        if(!map) return
        map.geocoder.on("result", ()=>{
            if(currentMarker){
                if(currentMarker.geocoderResult || insertionMode){
                    currentMarker.remove()
                }
            }
            setInsertionMode(false)
            setTitle(JSON.parse(map.geocoder.lastSelected).place_name)
            const linLat = map.geocoder.mapMarker._lngLat
            map.geocoder.mapMarker.remove()

            var marker = new mapboxgl.Marker()
            .setLngLat(linLat)
            .addTo(map)

            marker.geocoderResult = true
            setCurrentMarker(marker)
        })
    },[map, currentMarker])

    useEffect(()=>{
        if(map && insertionMode){
            const clickPoint = (e) => {
                if(currentMarker) currentMarker.remove()

                var marker = new mapboxgl.Marker()
                .setLngLat([e.lngLat.lng, e.lngLat.lat])
                .addTo(map)

                setTitle("")
                setDescription("")
                
                setCurrentMarker(marker)
            };
            map.once('click', clickPoint);
            return ()=>{map.off('click', clickPoint);}
        }
        // else if(map && !insertionMode && currentMarker){
        //     currentMarker.remove()
        //     setCurrentMarker(null)
        // }
    }, [map, insertionMode, currentMarker]);

    if(map && data && !markerLoaded){
        setMarkerLoaded(true)
        data.Marker.map(e=>{
            const linLat = e.geometry.coordinates
            var popup = new mapboxgl.Popup()
            .setHTML(`<h3>${e.properties.title}<h3><p>${e.properties.description}</p>`);

            var marker = new mapboxgl.Marker()
            .setLngLat(linLat)
            .setPopup(popup)
            .addTo(map)

            marker._id = e._id

            marker.getElement().addEventListener('click', () => {
                    setCurrentMarker(marker)
                    setTitle(e.properties.title)
                    setDescription(e.properties.description)
                });
        })
    }

    useEffect(()=>{
        if(!subscribeToMore || !map) return;
        subscribeToMore({
            document: MARKERS_SUBSCRIPTION,
            variables: {username: username},
            updateQuery: (prev, { subscriptionData }) => {
                const newData = subscriptionData.data.subscribeMarker
                switch(newData.mutation){
                    case "NEW":
                        const linLat = newData.data.geometry.coordinates
                        var popup = new mapboxgl.Popup()
                        .setHTML(`<h3>${newData.data.properties.title}<h3><p>${newData.data.properties.description}</p>`);

                        var marker = new mapboxgl.Marker()
                        .setLngLat(linLat)
                        .setPopup(popup)
                        .addTo(map)

                        marker._id = newData.data._id

                        marker.getElement().addEventListener('click', () => {
                            setCurrentMarker(marker)
                            setTitle(newData.data.properties.title)
                            setDescription(newData.data.properties.description)
                        });
                        return {Marker:[...prev.Marker, newData.data]}
                    break
                    case "DELETE":
                        return {Marker: prev.Marker.filter(e=>e._id !== newData.data._id)}
                    case "UPDATE":
                        return {Marker: prev.Marker.map(e=>{
                            if(e._id !== newData.data._id)
                                return e
                            return newData.data
                        })}
                    break
                    default:
                        console.log(`Warning: unknown mutation ${newData.mutation}`)
                    break
                }
            }
        })
    }, [map])

    const buttonOnclick = () => {
        if (currentMarker && (insertionMode || currentMarker.geocoderResult)){
            currentMarker.remove()
        }
        setCurrentMarker(null)
        setInsertionMode(!insertionMode)
    }
    const color = insertionMode? "green" : "white"
    return (
        <div>
            <div className='sidebarStyle'>
                <div>Longitude: {View.lng} | Latitude: {View.lat} | Zoom: {View.zoom} </div>
            </div>
            <Button style={{position: "relative", right: "0px","background-color":color}}
             onClick={buttonOnclick}>+</Button>
            <div ref={el => (mapContainer.current = el)} className='mapContainer' />
        </div>)
}

export default MapBox