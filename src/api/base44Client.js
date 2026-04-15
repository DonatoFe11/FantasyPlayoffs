import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Inizializziamo il client ufficiale di Supabase
const supabase = createClient(supabaseUrl, supabaseKey)

// Questa funzione adatta i comandi che la tua app già usa ai comandi di Supabase
function createEntityHandler(tableName) {
  return {
    list: async () => {
      const { data, error } = await supabase.from(tableName).select('*')
      if (error) throw error
      return data
    },
    filter: async (filters = {}) => {
      let query = supabase.from(tableName).select('*')
      // Applichiamo i filtri (es. id o fantasy_team_id)
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value)
      })
      const { data, error } = await query
      if (error) throw error
      return data
    },
    create: async (newData) => {
      const { data, error } = await supabase.from(tableName).insert(newData).select().single()
      if (error) throw error
      return data
    },
    update: async (id, updateData) => {
      const { data, error } = await supabase.from(tableName).update(updateData).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    delete: async (id) => {
      const { error } = await supabase.from(tableName).delete().eq('id', id)
      if (error) throw error
      return { success: true }
    }
  }
}

// Esportiamo l'oggetto "base44" così non dobbiamo cambiare nulla nelle tue pagine!
export const base44 = {
  entities: {
    Team: createEntityHandler('teams'),
    Player: createEntityHandler('players'),
    Series: createEntityHandler('series'),
    Match: createEntityHandler('matches'),
    LineupEntry: createEntityHandler('lineups')
  }
}