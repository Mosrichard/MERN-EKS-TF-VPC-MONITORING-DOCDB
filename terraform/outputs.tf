output "eks_cluster_endpoint" {
  value = aws_eks_cluster.main.endpoint
}

output "eks_cluster_name" {
  value = aws_eks_cluster.main.name
}

output "rds_database_name" {
  value = aws_db_instance.mysql.db_name
}

output "rds_username" {
  value = aws_db_instance.mysql.username
}
