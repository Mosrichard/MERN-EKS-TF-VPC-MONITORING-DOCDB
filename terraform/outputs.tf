output "eks_cluster_endpoint" {
  value = aws_eks_cluster.main.endpoint
}

output "eks_cluster_name" {
  value = aws_eks_cluster.main.name
}

output "docdb_endpoint" {
  value = aws_docdb_cluster.main.endpoint
}

output "pod_secrets_role_arn" {
  description = "IAM role ARN for application pods to access secrets"
  value       = aws_iam_role.pod_secrets_role.arn
}

output "external_secrets_role_arn" {
  description = "IAM role ARN for External Secrets Operator"
  value       = aws_iam_role.external_secrets_role.arn
}

output "secrets_manager_secret_name" {
  description = "Use this secret name in your ExternalSecret"
  value       = aws_secretsmanager_secret.docdb_secret.name
}
