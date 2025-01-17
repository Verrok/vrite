import { UnderscoreID } from "./mongo";
import { jsonToBuffer, DocJSON } from "./processing";
import { ObjectId, Db, Binary } from "mongodb";
import { LexoRank } from "lexorank";
import { FastifyInstance } from "fastify";
import {
  blocks,
  embeds,
  getWorkspaceSettingsCollection,
  marks
} from "#database/workspace-settings";
import { getWorkspacesCollection } from "#database/workspaces";
import { getWorkspaceMembershipsCollection } from "#database/workspace-memberships";
import { getRolesCollection } from "#database/roles";
import { FullUser } from "#database/users";
import {
  getContentGroupsCollection,
  getContentPieceVariantsCollection,
  getContentPiecesCollection,
  getContentVariantsCollection,
  getContentsCollection,
  getVariantsCollection
} from "#database";
import initialContent from "#assets/initial-content.json";

const createWorkspace = async (
  user: UnderscoreID<FullUser<ObjectId>>,
  fastify: FastifyInstance,
  config?: {
    name?: string;
    logo?: string;
    description?: string;
    defaultContent?: boolean;
  }
): Promise<ObjectId> => {
  const db = fastify.mongo.db!;
  const workspacesCollection = getWorkspacesCollection(db);
  const workspaceSettingsCollection = getWorkspaceSettingsCollection(db);
  const workspaceMembershipsCollection = getWorkspaceMembershipsCollection(db);
  const contentPiecesCollection = getContentPiecesCollection(db);
  const contentsCollection = getContentsCollection(db);
  const rolesCollection = getRolesCollection(db);
  const contentGroupsCollection = getContentGroupsCollection(db);
  const adminRoleId = new ObjectId();
  const workspaceId = new ObjectId();
  const ideasContentGroupId = new ObjectId();
  const contentPieceId = new ObjectId();
  const contentGroups = [
    { _id: ideasContentGroupId, name: "Ideas", ancestors: [], descendants: [], workspaceId },
    { _id: new ObjectId(), name: "Drafts", ancestors: [], descendants: [], workspaceId },
    {
      _id: new ObjectId(),
      name: "Published",
      ancestors: [],
      descendants: [],
      workspaceId,
      locked: true
    }
  ];

  await workspacesCollection.insertOne({
    name: config?.name || `${user.username}'s workspace`,
    _id: workspaceId,
    contentGroups: [],
    ...(config?.logo && { logo: config.logo }),
    ...(config?.description && { description: config.description }),
    ...(config?.defaultContent && {
      contentGroups: contentGroups.map(({ _id }) => _id)
    })
  });
  await workspaceSettingsCollection.insertOne({
    _id: new ObjectId(),
    workspaceId,
    blocks: [...blocks],
    embeds: [...embeds],
    marks: [...marks],
    prettierConfig: "{}"
  });
  await rolesCollection.insertMany([
    {
      _id: adminRoleId,
      name: "Admin",
      baseType: "admin",
      workspaceId,
      permissions: [
        "editContent",
        "editMetadata",
        "manageDashboard",
        "manageTokens",
        "manageWebhooks",
        "manageWorkspace",
        "manageExtensions",
        "manageVariants"
      ]
    },
    {
      _id: new ObjectId(),
      name: "Viewer",
      baseType: "viewer",
      workspaceId,
      permissions: []
    }
  ]);
  await workspaceMembershipsCollection.insertOne({
    _id: new ObjectId(),
    workspaceId,
    userId: user._id,
    roleId: adminRoleId
  });
  await fastify.search.createTenant(workspaceId);

  if (config?.defaultContent) {
    await contentGroupsCollection.insertMany(contentGroups);
    await contentPiecesCollection.insertOne({
      _id: contentPieceId,
      workspaceId,
      contentGroupId: ideasContentGroupId,
      title: "Hello World!",
      slug: "hello-world",
      members: [],
      tags: [],
      order: LexoRank.min().toString()
    });
    await contentsCollection.insertOne({
      _id: new ObjectId(),
      contentPieceId,
      content: new Binary(jsonToBuffer(initialContent as DocJSON))
    });
  }

  return workspaceId;
};
const deleteWorkspace = async (workspaceId: ObjectId, fastify: FastifyInstance): Promise<void> => {
  const db = fastify.mongo.db!;
  const workspacesCollection = getWorkspacesCollection(db);
  const workspaceSettingsCollection = getWorkspaceSettingsCollection(db);
  const workspaceMembershipsCollection = getWorkspaceMembershipsCollection(db);
  const contentPiecesCollection = getContentPiecesCollection(db);
  const contentsCollection = getContentsCollection(db);
  const rolesCollection = getRolesCollection(db);
  const variantsCollection = getVariantsCollection(db);
  const contentPieceVariantsCollection = getContentPieceVariantsCollection(db);
  const contentVariantsCollection = getContentVariantsCollection(db);
  const contentPieceIds = await contentPiecesCollection
    .find({ workspaceId })
    .map(({ _id }) => _id)
    .toArray();

  await workspacesCollection.deleteOne({
    _id: workspaceId
  });
  await workspaceSettingsCollection.deleteOne({
    workspaceId
  });
  await rolesCollection.deleteMany({
    workspaceId
  });
  await workspaceMembershipsCollection.deleteMany({
    workspaceId
  });
  await contentPiecesCollection.deleteMany({
    workspaceId
  });
  await contentsCollection.deleteMany({
    contentPieceId: { $in: contentPieceIds }
  });
  await variantsCollection.deleteMany({
    workspaceId
  });
  await contentPieceVariantsCollection.deleteMany({
    workspaceId
  });
  await contentVariantsCollection.deleteMany({
    contentPieceId: { $in: contentPieceIds }
  });
  await fastify.search.deleteTenant(workspaceId);
};

export { createWorkspace, deleteWorkspace };
