resource "aws_vpc" "eks_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { 
    Name                                = "my-eks-vpc"
    "kubernetes.io/cluster/my-eks-cluster" = "shared"
  }
}

# ==========================================
# 2. NETWORKING (Subnets & Discovery Tags)
# ==========================================
resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.eks_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "ap-south-1a"
  map_public_ip_on_launch = true
  tags = { 
    Name                                = "eks-public-1"
    "kubernetes.io/role/elb"            = "1"
    "kubernetes.io/cluster/my-eks-cluster" = "shared"
  }
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.eks_vpc.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "ap-south-1b"
  map_public_ip_on_launch = true
  tags = { 
    Name                                = "eks-public-2"
    "kubernetes.io/role/elb"            = "1"
    "kubernetes.io/cluster/my-eks-cluster" = "shared"
  }
}

resource "aws_subnet" "private_1" {
  vpc_id            = aws_vpc.eks_vpc.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "ap-south-1a"
  tags = { 
    Name                                = "eks-private-1"
    "kubernetes.io/role/internal-elb"   = "1"
    "kubernetes.io/cluster/my-eks-cluster" = "shared"
  }
}

resource "aws_subnet" "private_2" {
  vpc_id            = aws_vpc.eks_vpc.id
  cidr_block        = "10.0.12.0/24"
  availability_zone = "ap-south-1b"
  tags = { 
    Name                                = "eks-private-2"
    "kubernetes.io/role/internal-elb"   = "1"
    "kubernetes.io/cluster/my-eks-cluster" = "shared"
  }
}

# ==========================================
# 3. INTERNET ACCESS (NAT Gateway)
# ==========================================
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.eks_vpc.id
}

resource "aws_eip" "nat" {
  domain = "vpc"
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_1.id
  depends_on    = [aws_internet_gateway.igw]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.eks_vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.eks_vpc.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }
}

# ==========================================
# 3. INTERNET ACCESS (NAT Gateway) - FIXED
# ==========================================

# ... keep your igw, nat, and route table resources as they are ...

resource "aws_route_table_association" "pub_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "pub_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "pri_1" {
  subnet_id      = aws_subnet.private_1.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "pri_2" {
  subnet_id      = aws_subnet.private_2.id
  route_table_id = aws_route_table.private.id
}

# ==========================================
# 4. SECURITY GROUPS
# ==========================================
resource "aws_security_group" "eks_nodes_sg" {
  name   = "eks-nodes-sg"
  vpc_id = aws_vpc.eks_vpc.id

  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true
  }
  
  ingress {
    description = "Allow cluster to communicate with nodes"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "eks-nodes-sg"
    "kubernetes.io/cluster/my-eks-cluster" = "owned"
  }
}

resource "aws_security_group" "docdb_sg" {
  name   = "docdb-sg"
  vpc_id = aws_vpc.eks_vpc.id

  ingress {
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ==========================================
# 5. DOCUMENTDB & SECRETS MANAGER
# ==========================================
resource "random_password" "docdb_password" {
  length  = 16
  special = false
}

resource "aws_docdb_subnet_group" "main" {
  name       = "docdb-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]
}

resource "aws_docdb_cluster" "main" {
  cluster_identifier     = "my-docdb-cluster"
  engine                 = "docdb"
  master_username        = "adminuser"
  master_password        = random_password.docdb_password.result
  skip_final_snapshot    = true
  db_subnet_group_name   = aws_docdb_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.docdb_sg.id]
}

resource "aws_docdb_cluster_instance" "main" {
  identifier         = "my-docdb-instance"
  cluster_identifier = aws_docdb_cluster.main.id
  instance_class     = "db.t3.medium"
}

resource "aws_secretsmanager_secret" "docdb_secret" {
  name_prefix             = "my-docdb-mongo-uri-"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "docdb_creds" {
  secret_id = aws_secretsmanager_secret.docdb_secret.id
  secret_string = jsonencode({
    MONGO_URI = "mongodb://${aws_docdb_cluster.main.master_username}:${random_password.docdb_password.result}@${aws_docdb_cluster.main.endpoint}:27017/mydatabase?ssl=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false"
  })
}

# ==========================================
# 6. IAM ROLES (Cluster + Nodes + IRSA)
# ==========================================
resource "aws_iam_role" "cluster_role" {
  name = "my-eks-cluster-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "eks.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "cluster_policy" {
  role       = aws_iam_role.cluster_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role" "node_role" {
  name = "my-eks-node-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "node_policies" {
  for_each = toset([
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
    "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  ])
  role       = aws_iam_role.node_role.name
  policy_arn = each.value
}

# ==========================================
# 7. EKS CLUSTER & NODE GROUP
# ==========================================
resource "aws_eks_cluster" "main" {
  name     = "my-eks-cluster"
  role_arn = aws_iam_role.cluster_role.arn
  version  = "1.31"

  vpc_config {
    subnet_ids              = [aws_subnet.private_1.id, aws_subnet.private_2.id, aws_subnet.public_1.id, aws_subnet.public_2.id]
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  depends_on = [aws_iam_role_policy_attachment.cluster_policy]
}

resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "standard-nodes"
  node_role_arn   = aws_iam_role.node_role.arn
  subnet_ids      = [aws_subnet.private_1.id, aws_subnet.private_2.id]

  scaling_config {
    desired_size = 2
    min_size     = 1
    max_size     = 3
  }

  instance_types = ["t3.medium"]
  
  update_config {
    max_unavailable = 1
  }

  depends_on = [
    aws_iam_role_policy_attachment.node_policies,
    aws_eks_cluster.main
  ]
}

# ==========================================
# 8. OIDC FOR IRSA
# ==========================================
data "tls_certificate" "eks" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "oidc" {
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
}

# ==========================================
# 9. IAM ROLE FOR EXTERNAL SECRETS OPERATOR
# ==========================================
resource "aws_iam_role" "external_secrets_role" {
  name = "eks-external-secrets-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRoleWithWebIdentity",
      Effect = "Allow",
      Principal = {
        Federated = aws_iam_openid_connect_provider.oidc.arn
      },
      Condition = {
        StringEquals = {
          "${replace(aws_iam_openid_connect_provider.oidc.url, "https://", "")}:sub" = "system:serviceaccount:external-secrets:external-secrets"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "external_secrets_policy" {
  role = aws_iam_role.external_secrets_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecrets"
      ],
      Resource = aws_secretsmanager_secret.docdb_secret.arn
    }]
  })
}

# ==========================================
# 10. IAM ROLE FOR APPLICATION PODS
# ==========================================
resource "aws_iam_role" "pod_secrets_role" {
  name = "eks-pod-secrets-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRoleWithWebIdentity",
      Effect = "Allow",
      Principal = {
        Federated = aws_iam_openid_connect_provider.oidc.arn
      },
      Condition = {
        StringEquals = {
          "${replace(aws_iam_openid_connect_provider.oidc.url, "https://", "")}:sub" = "system:serviceaccount:mern-app:my-app-sa"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "pod_secrets_policy" {
  role = aws_iam_role.pod_secrets_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      Resource = aws_secretsmanager_secret.docdb_secret.arn
    }]
  })
}
