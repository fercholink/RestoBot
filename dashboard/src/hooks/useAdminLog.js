import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Fire-and-forget hook for writing to admin_activity_log.
 * RLS allows any authenticated user to insert their own record.
 * Only fercho028890@gmail.com can SELECT from the table.
 */
export function useAdminLog() {
    const { user } = useAuth();

    const log = useCallback(async ({
        action,
        module,
        entity_type = null,
        entity_id = null,
        description,
        old_value = null,
        new_value = null,
        organization_id = null,
        organization_name = null,
        branch_id = null,
        branch_name = null,
    }) => {
        if (!user?.id) return;
        try {
            await supabase.from('admin_activity_log').insert([{
                user_id:           user.id,
                user_email:        user.email ?? '',
                user_name:         user.user_metadata?.full_name ?? user.email ?? '',
                organization_id:   organization_id ?? user.organization_id ?? null,
                organization_name: organization_name ?? null,
                branch_id:         branch_id ?? user.branch_id ?? null,
                branch_name:       branch_name ?? null,
                action,
                module,
                entity_type,
                entity_id:         entity_id != null ? String(entity_id) : null,
                description,
                old_value,
                new_value,
                user_agent:        navigator?.userAgent?.slice(0, 200) ?? null,
            }]);
        } catch (err) {
            console.warn('[AdminLog] write failed:', err.message);
        }
    }, [user]);

    return { log };
}
