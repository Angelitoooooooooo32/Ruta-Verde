import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RecoleccionService } from '../../core/services/recoleccion.service';
import { AdminDataService } from '../../core/services/admin-data.service';

@Component({
  selector: 'app-editor-ruta',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './editor-ruta.component.html',
  styleUrls: ['./editor-ruta.component.scss']
})
export class EditorRutaComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private reco = inject(RecoleccionService);
  private admin = inject(AdminDataService);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nombre_ruta: ['', [Validators.required]]
  });

  private map: any;
  private layerGroup: any;
  private drawnItems: any;
  private apiCallesLayer: any;
  private leafletLoaded = false;
  private isDrawing = false;
  private tempPoints: Array<[number, number]> = [];
  private tempPolyline: any = null;
  puntos = signal<Array<[number, number]>>([]); // [lat, lng]

  async ngOnInit() {
    await this.loadLeafletFromCdn();
    this.initMap();
    await this.drawApiCalles();
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) {
      try {
        // Primero intenta desde Supabase
        const supa = await this.admin.getRuta(id);
        const data: any = supa ?? await this.reco.getRutaById(id).catch(() => null);
        const coords = this.extractCoords(
          data?.coordenadas || data?.geometria || data?.geometry || data?.shape || data?.coordinates
        );
        if (coords && coords.length) {
          this.puntos.set(coords);
          this.draw();
          this.fitBounds();
        }
        if (data?.nombre) this.form.controls.nombre_ruta.setValue(String(data.nombre));
      } catch {
        // ignore
      }
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.off();
      this.map.remove();
    }
  }

  private async loadLeafletFromCdn(): Promise<void> {
    if (this.leafletLoaded) return;

    // CSS Leaflet base
    await new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      link.onload = () => resolve();
      link.onerror = () => reject(new Error('No se pudo cargar Leaflet CSS'));
      document.head.appendChild(link);
    });

    // CSS leaflet-draw
    await new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css';
      link.crossOrigin = '';
      link.onload = () => resolve();
      link.onerror = () => reject(new Error('No se pudo cargar Leaflet Draw CSS'));
      document.head.appendChild(link);
    });

    // JS Leaflet base
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar Leaflet JS'));
      document.body.appendChild(script);
    });

    // JS leaflet-draw
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js';
      script.crossOrigin = '';
      script.onload = () => { this.leafletLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('No se pudo cargar Leaflet Draw JS'));
      document.body.appendChild(script);
    });
  }

  private initMap() {
    const L = (window as any).L;
    if (!L) return;

    const BV_COORDS: [number, number] = [3.882, -77.031];

    this.map = L.map('editor-map', {
      center: BV_COORDS,
      zoom: 13
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);

    // Grupo para puntos
    this.layerGroup = L.layerGroup().addTo(this.map);
    this.drawnItems = new L.FeatureGroup();
    this.map.addLayer(this.drawnItems);

    // Inicializar estado de dibujo
    this.isDrawing = false;
    this.tempPoints = [];
    this.tempPolyline = null;

    this.map.on('click', (e: any) => {
      if (!this.isDrawing) return;

      const point: [number, number] = [e.latlng.lat, e.latlng.lng];
      this.tempPoints.push(point);

      // Dibujar marcador
      L.circleMarker(point, {
        radius: 6,
        fillColor: '#059669',
        color: '#000',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(this.layerGroup);

      // Dibujar línea temporal
      if (this.tempPoints.length > 1) {
        if (this.tempPolyline) {
          this.layerGroup.removeLayer(this.tempPolyline);
        }
        this.tempPolyline = L.polyline(this.tempPoints, {
          color: '#059669',
          weight: 3
        }).addTo(this.layerGroup);
      }

      // Actualizar puntos reactivos para habilitar Guardar ruta
      this.puntos.set([...this.tempPoints]);
    });

    // Botones para controlar dibujo manual
    this.createDrawingControls();
  }

  private createDrawingControls() {
    // Crear controles personalizados si es necesario
    const L = (window as any).L;
    if (!L || !this.map) return;

    const component = this;

    const CustomControl = L.Control.extend({
      options: {
        position: 'topleft'
      },

      onAdd: function (map: any) {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        container.style.backgroundColor = 'white';
        container.style.padding = '5px';

        const startBtn = L.DomUtil.create('button', '', container);
        startBtn.innerHTML = '✏️ Iniciar dibujo';
        startBtn.style.margin = '2px';
        startBtn.onclick = () => {
          // Iniciar modo dibujo
          component.clearAll();
          component.isDrawing = true;
          component.tempPoints = [];
          if (component.tempPolyline && component.layerGroup) {
            component.layerGroup.removeLayer(component.tempPolyline);
          }
          component.tempPolyline = null;
          console.log('Iniciar dibujo');
        };

        const endBtn = L.DomUtil.create('button', '', container);
        endBtn.innerHTML = '✅ Finalizar';
        endBtn.style.margin = '2px';
        endBtn.onclick = () => {
          // Finalizar modo dibujo y guardar puntos
          component.isDrawing = false;
          if (component.tempPoints.length < 2) {
            component.error.set('La ruta debe tener al menos 2 puntos');
            return;
          }
          component.puntos.set([...component.tempPoints]);
          component.draw();
          component.fitBounds();
          console.log('Finalizar dibujo');
        };

        return container;
      }
    });

    this.map.addControl(new (CustomControl as any)());
  }

  private draw() {
    const L: any = (window as any).L;
    if (!this.layerGroup || !L) return;
    this.layerGroup.clearLayers();
    const pts = this.puntos();
    for (const p of pts) {
      L.circleMarker(p, { radius: 4, color: '#059669' }).addTo(this.layerGroup);
    }
    if (pts.length > 1) {
      L.polyline(pts, { color: '#059669', weight: 3 }).addTo(this.layerGroup);
    }
  }

  private async drawApiCalles() {
    const L: any = (window as any).L;
    if (!this.map || !L) return;
    try {
      const calles = await this.reco.getCalles();
      if (!this.apiCallesLayer) this.apiCallesLayer = L.layerGroup().addTo(this.map);
      this.apiCallesLayer.clearLayers();
      for (const c of calles) {
        const coords = (c as any).coordenadas as Array<[number, number]> | undefined;
        if (coords && coords.length > 1) {
          L.polyline(coords, { color: '#f97316', weight: 2, opacity: 0.6 }).addTo(this.apiCallesLayer);
        }
      }
    } catch {
      // silencioso, no afecta al editor si falla la API
    }
  }

  private fitBounds() {
    const L: any = (window as any).L;
    if (!this.map || !L) return;
    const pts = this.puntos();
    if (!pts.length) return;
    const bounds = L.latLngBounds(pts.map(p => ({ lat: p[0], lng: p[1] })));
    this.map.fitBounds(bounds.pad(0.2));
  }

  undo() {
    this.puntos.update(arr => arr.slice(0, -1));
    this.draw();
  }

  clearAll() {
    this.puntos.set([]);
    this.draw();
  }

  async save() {
    if (this.loading() || this.form.invalid || this.puntos().length < 2) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      // GeoJSON exige [lng, lat]
      const coordinates = this.puntos().map(p => [p[1], p[0]]);
      const body = {
        nombre_ruta: this.form.controls.nombre_ruta.value,
        shape: { type: 'LineString', coordinates }
      };
      const id = this.route.snapshot.queryParamMap.get('id');
      if (!id) {
        // Nueva: crear en API y en Supabase (guardando ext_id)
        const creado = await this.reco.crearRuta(body);
        const extId = (creado as any)?.id ?? (creado as any)?.data?.id ?? (creado as any)?.ruta?.id ?? null;
        await this.admin.createRuta({
          nombre: String(this.form.controls.nombre_ruta.value || 'Ruta'),
          geometria: { type: 'LineString', coordinates },
          coordenadas: this.puntos(),
          ext_id: extId ?? undefined
        });
      } else {
        // Edición: actualizar en Supabase
        await this.admin.updateRuta(id, {
          nombre: String(this.form.controls.nombre_ruta.value || 'Ruta'),
          geometria: { type: 'LineString', coordinates },
          coordenadas: this.puntos()
        });
      }
      this.success.set('Ruta guardada');
      setTimeout(() => this.router.navigateByUrl('/admin/rutas'), 800);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'No se pudo guardar la ruta');
    } finally {
      this.loading.set(false);
    }
  }

  private extractCoords(raw: any): Array<[number, number]> | null {
    try {
      if (!raw) return null;
      if (typeof raw === 'string') raw = JSON.parse(raw);
      // Si ya viene como [[lat,lng], ...]
      if (Array.isArray(raw) && Array.isArray(raw[0])) {
        return raw as Array<[number, number]>;
      }
      // GeoJSON LineString
      if (raw?.type === 'LineString' && Array.isArray(raw.coordinates)) {
        return raw.coordinates.map((c: any) => [Number(c[1]), Number(c[0])]);
      }
    } catch {
      return null;
    }
    return null;
  }
}
