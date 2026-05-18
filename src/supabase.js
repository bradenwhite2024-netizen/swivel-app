import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rewgwolwehlyihfahzto.supabase.co'
const supabaseKey = 'sb_publishable_0OItw7Y04ETH3wD2-jxZ5Q_HMWSIrSK'

export const supabase = createClient(supabaseUrl, supabaseKey)