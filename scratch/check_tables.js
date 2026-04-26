
import { supabase } from './dashboard/src/lib/supabase';

async function checkTables() {
    console.log('Checking tables...');
    try {
        const { data: activityLogs, error: activityError } = await supabase.from('admin_activity_log').select('*').limit(1);
        console.log('admin_activity_log:', activityError ? 'Error: ' + activityError.message : 'OK (' + activityLogs.length + ' rows)');

        const { data: auditLogs, error: auditError } = await supabase.from('audit_log').select('*').limit(1);
        console.log('audit_log:', auditError ? 'Error: ' + auditError.message : 'OK (' + auditLogs.length + ' rows)');

        const { data: globalLogs, error: globalError } = await supabase.from('global_logs').select('*').limit(1);
        console.log('global_logs:', globalError ? 'Error: ' + globalError.message : 'OK (' + globalLogs.length + ' rows)');
    } catch (e) {
        console.error('Fatal error:', e);
    }
}

checkTables();
