import { Injectable, signal, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabaseUrl = 'https://ihwzhhbaupjtoqxxxypx.supabase.co';
  private supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlod3poaGJhdXBqdG9xeHh4eXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MDY0NTMsImV4cCI6MjA4MDM4MjQ1M30.CbHrBIGHHemL1i_VQCpYwdqOfNLFCRg0GshmVggXTHA';
  
  private router = inject(Router);
  private supabase: SupabaseClient;
  
  // Signals para estado de autenticación
  isLoggedIn = signal(false);
  isLoading = signal(false);
  role = signal<string | null>(null);
  currentUser = signal<{ id: string; email: string; name: string } | null>(null);
  profile = signal<any>(null);
  accessToken = signal<string | null>(null);

  constructor() {
    this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);
    this.loadSessionFromStorage();
  }

  private loadSessionFromStorage() {
    const session = localStorage.getItem('auth_session');
    if (session) {
      try {
        const user = JSON.parse(session);
        this.isLoggedIn.set(true);
        this.role.set(user.role);
        this.currentUser.set({
          id: user.userId,
          email: user.email,
          name: user.name
        });
        this.accessToken.set(user.token);
        this.profile.set(user);
      } catch (e) {
        console.error('Error cargando sesión:', e);
      }
    }
  }

  async login(credentials: { email: string; password: string }) {
    try {
      this.isLoading.set(true);
      console.log('🔐 Intentando login con:', credentials.email);
      
      // 1. Buscar usuario por email en la tabla profiles
      const { data: user, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('email', credentials.email.toLowerCase().trim())
        .single();

      if (error || !user) {
        console.error('❌ Usuario no encontrado:', error);
        return { 
          success: false, 
          error: 'Correo o contraseña incorrectos' 
        };
      }

      // 2. Verificar contraseña (ajusta según tu estructura)
      // Si tienes password en texto plano:
      const passwordMatches = credentials.password === user.password;
      
      // Si tienes password_hash (descomenta):
      // const passwordMatches = await bcrypt.compare(credentials.password, user.password_hash);
      
      if (!passwordMatches) {
        console.error('❌ Contraseña incorrecta');
        return { 
          success: false, 
          error: 'Correo o contraseña incorrectos' 
        };
      }

      console.log('✅ Login exitoso:', user.name);

      // 3. Actualizar last_login si existe esa columna
      try {
        await this.supabase
          .from('profiles')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', user.id);
      } catch (e) {
        console.warn('No se pudo actualizar last_login:', e);
      }

      // 4. Crear sesión
      const sessionData = {
        userId: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role || 'conductor',
        loggedIn: true,
        token: this.generateToken(user.id)
      };

      this.saveSession(sessionData);
      
      // Actualizar signals
      this.isLoggedIn.set(true);
      this.role.set(sessionData.role);
      this.currentUser.set({
        id: user.id,
        email: user.email,
        name: user.name
      });
      this.accessToken.set(sessionData.token);
      this.profile.set(user);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      };

    } catch (error: any) {
      console.error('💥 Error en login:', error);
      return { 
        success: false, 
        error: error.message || 'Error inesperado. Intenta nuevamente.' 
      };
    } finally {
      this.isLoading.set(false);
    }
  }

  async register(formValue: { 
    name: string; 
    email: string; 
    password: string;
    role: string;
  }): Promise<{ success: boolean; error?: string; userId?: string; message?: string }> {
    try {
      this.isLoading.set(true);
      
      // Crear el usuario directamente en la tabla profiles
      const { data, error } = await this.supabase
        .from('profiles')
        .insert([
          {
            email: formValue.email,
            name: formValue.name,
            password: formValue.password,
            role: formValue.role || 'cliente',
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        console.error('Error al registrar:', error);
        return { 
          success: false, 
          error: error.message 
        };
      }

      if (!data || data.length === 0) {
        return { 
          success: false, 
          error: 'No se pudo crear el usuario' 
        };
      }

      const newUser = data[0];
      console.log('✅ Usuario registrado:', newUser.id);
      return { 
        success: true, 
        userId: newUser.id,
        message: 'Registro exitoso. Ahora puedes iniciar sesión.' 
      };

    } catch (error: any) {
      console.error('Error en register:', error);
      return { 
        success: false, 
        error: error.message || 'Error de conexión' 
      };
    } finally {
      this.isLoading.set(false);
    }
  }

  private generateToken(userId: string): string {
    const tokenData = {
      userId: userId,
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 días
      iat: Date.now()
    };
    return btoa(JSON.stringify(tokenData));
  }

  async getSession() {
    const session = localStorage.getItem('auth_session');
    if (session) {
      const data = JSON.parse(session);
      return { data: { session: data }, error: null };
    }
    return { data: { session: null }, error: 'No session found' };
  }

  async resetPassword(email: string) {
    try {
      console.log('🔄 Intentando resetear contraseña para:', email);
      
      // Usar RPC para resetear contraseña
      const { error } = await this.supabase
        .rpc('reset_password_request', {
          p_email: email
        });

      if (error) {
        console.error('Error al resetear contraseña:', error);
        return { error };
      }

      console.log('✅ Email de reseteo enviado a:', email);
      return { error: null };

    } catch (error: any) {
      console.error('Error en resetPassword:', error);
      return { error };
    }
  }

  async signOut() {
    try {
      console.log('👋 Cerrando sesión');
      this.logout();
      return { error: null };
    } catch (error: any) {
      console.error('Error en signOut:', error);
      return { error };
    }
  }

  private saveSession(sessionData: any) {
    localStorage.setItem('auth_session', JSON.stringify(sessionData));
    sessionStorage.setItem('auth_token', sessionData.token);
    document.cookie = `auth_token=${sessionData.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`;
  }

  logout() {
    localStorage.removeItem('auth_session');
    sessionStorage.removeItem('auth_token');
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    // Limpiar signals
    this.isLoggedIn.set(false);
    this.role.set(null);
    this.currentUser.set(null);
    this.accessToken.set(null);
    this.profile.set(null);
    
    // Navegar al login
    this.router.navigate(['/auth/login']);
  }

  getCurrentUser() {
    const session = localStorage.getItem('auth_session');
    if (session) {
      return JSON.parse(session);
    }
    return null;
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }
}