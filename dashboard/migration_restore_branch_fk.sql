-- Restablecer la relación entre Perfiles y Sedes (Foreign Key)
-- Esto es necesario para que el sistema pueda mostrar el nombre de la sede en la lista de usuarios.
-- (Sin esto, la consulta "branch:branches(name)" falla y la lista no carga).

ALTER TABLE profiles
ADD CONSTRAINT profiles_branch_id_fkey
FOREIGN KEY (branch_id)
REFERENCES branches(id)
ON DELETE SET NULL;
