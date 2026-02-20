select status, type, count(id) from orders group by status, type;
